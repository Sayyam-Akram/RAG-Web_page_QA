"""FastAPI REST API for the RAG Q&A Assistant with thread management and persistence."""
import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
import tempfile, shutil, json, uuid
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loaders import load_from_urls, load_from_files
from rag_engine import (
    # build_vectorstore, # Removed
    query, 
    query_stream, 
    generate_title, 
    list_sources, 
    clear_vectorstore,
    get_vectorstore # Helper to ensure init
)

# ... (lines 24-110 skipped in replacement context, doing targeted chunks)
# Actually, I should do this in multiple chunks if they are far apart.
# Tool supports multiple chunks.


# --- Thread storage ---
THREADS_DIR = Path(__file__).parent / "threads"
THREADS_DIR.mkdir(exist_ok=True)

# --- In-memory state (Cache for UI) ---
_state = {"sources": []}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load sources from Chroma
    print("Loading persistent knowledge base...")
    try:
        _state["sources"] = list_sources()
        print(f"Loaded {len(_state['sources'])} sources from disk.")
    except Exception as e:
        print(f"Error loading sources: {e}")
    yield
    # Shutdown

app = FastAPI(title="CiteFlow API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    active_sources: list[str] | None = None
    # Advanced Settings
    top_k: int = 5
    hybrid_search: bool = True
    temperature: float = 0.3 # Not used in query() directly but could be passed if we refactor get_llm

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

        # Add to Chroma (Persistent)
        get_vectorstore().add_documents(docs)
        
        # Update cache
        _state["sources"] = list_sources()

        return {"ok": True, "loaded": len(docs), "errors": errors, "sources": _state["sources"]}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/api/load-urls")
async def load_urls(req: URLRequest):
    try:
        docs, errors = load_from_urls(req.urls)
        if not docs:
            return {"ok": False, "errors": errors or ["No documents could be loaded."]}

        # Add to Chroma (Persistent)
        get_vectorstore().add_documents(docs)
        
        # Update cache
        _state["sources"] = list_sources()

        return {"ok": True, "loaded": len(docs), "errors": errors, "sources": _state["sources"]}
    except Exception as e:
        return {"ok": False, "errors": [f"Processing error: {str(e)[:200]}"]}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Check if we have any data (optional, but good for UX)
    if not _state["sources"]:
         return {"ok": False, "error": "Knowledge base is empty. Please upload documents."}

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

    # Run RAG query (with retry)
    import time
    result = None
    for attempt in range(2):
        try:
            result = query(
                question=req.question, 
                history=recent_history, 
                filter_list=req.active_sources,
                top_k=req.top_k,
                hybrid=req.hybrid_search
            )
            break
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate" in err_str.lower():
                if attempt == 0:
                    time.sleep(3)
                    continue
                return {"ok": False, "error": "⏳ Rate limited. Try again."}
            return {"ok": False, "error": f"LLM error: {err_str[:200]}"}

    if result is None:
        return {"ok": False, "error": "Failed to get response."}

    # Save to thread
    thread["messages"].append({"role": "user", "content": req.question, "timestamp": datetime.now().isoformat()})
    thread["messages"].append({
        "role": "assistant", "content": result["answer"],
        "sources": result["sources"], "in_kb": result["in_kb"],
        "timestamp": datetime.now().isoformat(),
    })
    
    # Auto-generate title
    new_title = None
    if len(thread["messages"]) == 2:
        new_title = generate_title(req.question, result["answer"])
        thread["title"] = new_title

    _save_thread(thread_id, thread)

    return {"ok": True, "thread_id": thread_id, "title": new_title, **result}


@app.post("/api/chat-stream")
async def chat_stream(req: ChatRequest):
    if not _state["sources"]:
        return {"error": "Knowledge base is empty."}

    thread_id = req.thread_id or str(uuid.uuid4())
    
    thread = _load_thread(thread_id) or {
        "id": thread_id,
        "title": req.question[:50],
        "created": datetime.now().isoformat(),
        "messages": [],
    }
    
    recent_history = ""
    if thread["messages"]:
        last_msgs = thread["messages"][-6:]
        recent_history = "\n".join([f"{'User' if m['role']=='user' else 'Assistant'}: {m['content'][:200]}" for m in last_msgs])

    def stream_wrapper():
        try:
            # Note: query_stream currently force-enables hybrid in rag_engine.py logic unless we update it.
            # We pass top_k.
            gen = query_stream(
                question=req.question, 
                history=recent_history, 
                filter_list=req.active_sources,
                top_k=req.top_k
            )
            
            # 1. Sources Payload
            try:
                sources_json = next(gen)
                data = json.loads(sources_json)
                data["thread_id"] = thread_id
                yield json.dumps(data) + "\n"
                
                sources_data = data
            except StopIteration:
                yield json.dumps({"error": "No response generated."})
                return
            except Exception as e:
                yield json.dumps({"error": str(e)})
                return

            # 2. Stream Content
            full_answer = ""
            for chunk in gen:
                full_answer += chunk
                yield chunk
            
            # 3. Save to Thread
            thread["messages"].append({"role": "user", "content": req.question, "timestamp": datetime.now().isoformat()})
            thread["messages"].append({
                "role": "assistant", 
                "content": full_answer,
                "sources": sources_data.get("sources", []),
                "in_kb": sources_data.get("in_kb", True),
                "timestamp": datetime.now().isoformat(),
            })
            
            if len(thread["messages"]) == 2:
                try:
                    new_title = generate_title(req.question, full_answer)
                    thread["title"] = new_title
                except: pass

            _save_thread(thread_id, thread)
            
        except Exception as e:
            yield json.dumps({"error": f"Stream error: {str(e)}"})

    return StreamingResponse(stream_wrapper(), media_type="text/plain")


@app.get("/api/status")
async def status():
    # Return count of sources and if ready
    return {"ready": len(_state["sources"]) > 0, "sources": _state["sources"]}


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
    clear_vectorstore()
    _state["sources"] = []
    # Also clear threads? Maybe optionally. For now, just KB.
    return {"ok": True}
# reload trigger
