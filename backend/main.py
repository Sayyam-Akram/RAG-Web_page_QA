"""FastAPI REST API for the RAG Q&A Assistant with thread management."""
import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
import tempfile, shutil, json, uuid
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loaders import load_from_urls, load_from_files
from rag_engine import build_vectorstore, query

app = FastAPI(title="RAG Q&A Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Thread storage ---
THREADS_DIR = Path(__file__).parent / "threads"
THREADS_DIR.mkdir(exist_ok=True)

# --- In-memory state ---
_state = {"retriever": None, "sources": []}


def _save_thread(thread_id: str, data: dict):
    (THREADS_DIR / f"{thread_id}.json").write_text(json.dumps(data, default=str), encoding="utf-8")


def _load_thread(thread_id: str) -> dict | None:
    path = THREADS_DIR / f"{thread_id}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def _list_threads() -> list:
    threads = []
    for f in sorted(THREADS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        data = json.loads(f.read_text(encoding="utf-8"))
        threads.append({
            "id": data["id"],
            "title": data.get("title", "New Chat"),
            "created": data.get("created", ""),
            "message_count": len(data.get("messages", [])),
        })
    return threads


# --- Models ---
class URLRequest(BaseModel):
    urls: str

class ChatRequest(BaseModel):
    question: str
    thread_id: str | None = None

class ThreadRename(BaseModel):
    title: str


# --- Endpoints ---
@app.post("/api/upload-files")
async def upload_files(files: list[UploadFile] = File(...)):
    temp_dir = tempfile.mkdtemp()
    file_infos = []
    try:
        for f in files:
            path = os.path.join(temp_dir, f.filename)
            with open(path, "wb") as out:
                out.write(await f.read())
            file_infos.append({"path": path, "name": f.filename})

        docs, errors = load_from_files(file_infos)
        if not docs:
            return {"ok": False, "errors": errors or ["No documents could be loaded."]}

        vs = build_vectorstore(docs)
        _state["retriever"] = vs.as_retriever(search_kwargs={"k": 4})

        for d in docs:
            title = d.metadata.get("title", "Unknown")
            if title not in [s["title"] for s in _state["sources"]]:
                _state["sources"].append({"title": title, "url": "", "file": d.metadata.get("source_file", ""), "type": "file"})

        return {"ok": True, "loaded": len(docs), "errors": errors, "sources": _state["sources"]}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/api/load-urls")
async def load_urls(req: URLRequest):
    try:
        docs, errors = load_from_urls(req.urls)
        if not docs:
            return {"ok": False, "errors": errors or ["No documents could be loaded."]}

        vs = build_vectorstore(docs)
        _state["retriever"] = vs.as_retriever(search_kwargs={"k": 4})

        for d in docs:
            title = d.metadata.get("title", "Unknown")
            if title not in [s["title"] for s in _state["sources"]]:
                _state["sources"].append({"title": title, "url": d.metadata.get("source_url", ""), "file": "", "type": "url"})

        return {"ok": True, "loaded": len(docs), "errors": errors, "sources": _state["sources"]}
    except Exception as e:
        return {"ok": False, "errors": [f"Processing error: {str(e)[:200]}"]}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not _state["retriever"]:
        return {"ok": False, "error": "No data source loaded. Upload files or URLs first."}

    # Load or create thread
    thread_id = req.thread_id or str(uuid.uuid4())
    thread = _load_thread(thread_id) or {
        "id": thread_id,
        "title": req.question[:50] + ("..." if len(req.question) > 50 else ""),
        "created": datetime.now().isoformat(),
        "messages": [],
    }

    # Build conversation context for memory
    recent_history = ""
    if thread["messages"]:
        last_msgs = thread["messages"][-6:]  # Last 3 exchanges
        pairs = []
        for m in last_msgs:
            role = "User" if m["role"] == "user" else "Assistant"
            pairs.append(f"{role}: {m['content'][:200]}")
        recent_history = "\n".join(pairs)

    # Run RAG query with conversation context + retry for rate limits
    import time
    result = None
    for attempt in range(2):
        try:
            result = query(_state["retriever"], req.question, recent_history)
            break
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate" in err_str.lower():
                if attempt == 0:
                    time.sleep(3)  # Wait and retry once
                    continue
                return {"ok": False, "error": "⏳ The model is rate-limited right now. Please wait a moment and try again."}
            return {"ok": False, "error": f"LLM error: {err_str[:200]}"}

    if result is None:
        return {"ok": False, "error": "Failed to get a response. Please try again."}

    # Save to thread
    thread["messages"].append({"role": "user", "content": req.question, "timestamp": datetime.now().isoformat()})
    thread["messages"].append({
        "role": "assistant", "content": result["answer"],
        "sources": result["sources"], "in_kb": result["in_kb"],
        "timestamp": datetime.now().isoformat(),
    })
    _save_thread(thread_id, thread)

    return {"ok": True, "thread_id": thread_id, **result}


@app.get("/api/status")
async def status():
    return {"ready": _state["retriever"] is not None, "sources": _state["sources"]}


@app.get("/api/threads")
async def get_threads():
    return {"threads": _list_threads()}


@app.get("/api/threads/{thread_id}")
async def get_thread(thread_id: str):
    thread = _load_thread(thread_id)
    if not thread:
        return {"ok": False, "error": "Thread not found"}
    return {"ok": True, "thread": thread}


@app.put("/api/threads/{thread_id}")
async def rename_thread(thread_id: str, req: ThreadRename):
    thread = _load_thread(thread_id)
    if not thread:
        return {"ok": False, "error": "Thread not found"}
    thread["title"] = req.title
    _save_thread(thread_id, thread)
    return {"ok": True}


@app.delete("/api/threads/{thread_id}")
async def delete_thread(thread_id: str):
    path = THREADS_DIR / f"{thread_id}.json"
    if path.exists():
        path.unlink()
    return {"ok": True}


@app.post("/api/clear")
async def clear():
    _state["retriever"] = None
    _state["sources"] = []
    return {"ok": True}
