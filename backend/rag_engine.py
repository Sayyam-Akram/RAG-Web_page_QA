"""RAG engine: Persistent Vector Store (Chroma), Hybrid Search (BM25+Vector), and Re-ranking."""
import os
import re
import shutil
import json
from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.retrievers import BM25Retriever
# from langchain.retrievers import EnsembleRetriever # Removed
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
from flashrank import Ranker, RerankRequest
import config as cfg

# Ensure Chroma directory exists
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "data", "chroma_db")
os.makedirs(CHROMA_PATH, exist_ok=True)

_embeddings = None
_llm = None
_vectorstore = None
_ranker = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        # Use a high-quality local embedding model
        _embeddings = HuggingFaceEmbeddings(model_name=cfg.EMBEDDING_MODEL)
    return _embeddings

def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            api_key=cfg.OPENROUTER_API_KEY,
            base_url=cfg.BASE_URL,
            model=cfg.MODEL,
            temperature=cfg.LLM_TEMPERATURE,
        )
    return _llm

def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=get_embeddings(),
            collection_name="rag_documents"
        )
    return _vectorstore

def get_ranker():
    global _ranker
    if _ranker is None:
        # Load FlashRank model (Tiny & Fast)
        _ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2", cache_dir="./data/flashrank")
    return _ranker

def clear_vectorstore():
    global _vectorstore
    if os.path.exists(CHROMA_PATH):
        # Force close connection if possible or just delete dir
        try:
            shutil.rmtree(CHROMA_PATH)
            os.makedirs(CHROMA_PATH, exist_ok=True)
            _vectorstore = None
        except Exception as e:
            print(f"Error clearing Chroma: {e}")

def list_sources():
    """List all unique sources in the vector store."""
    vs = get_vectorstore()
    try:
        # Get all metadata
        data = vs.get()
        metadatas = data['metadatas']
        
        seen = set()
        sources = []
        for m in metadatas:
            title = m.get("title", "Unknown")
            if title not in seen:
                seen.add(title)
                sources.append({
                    "title": title,
                    "url": m.get("source_url", ""),
                    "file": m.get("source_file", ""),
                    "type": m.get("type", "unknown")
                })
        return sources
    except:
        return []

    """Add documents to the persistent vector store."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg.CHUNK_SIZE, chunk_overlap=cfg.CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(documents)
    
    vs = get_vectorstore()
    vs.add_documents(chunks)
    return vs

def get_hybrid_retriever(vectorstore, active_sources=None):
    """Create an ensemble retriever (Vector + BM25)."""
    
    # 1. Vector Retriever
    # Using MMals (Maximal Marginal Relevance) for diversity
    base_retriever = vectorstore.as_retriever(
        search_type="mmr", 
        search_kwargs={"k": 20, "fetch_k": 50} 
    )
    
    # Apply filter if active_sources provided
    if active_sources:
        base_retriever = vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 20, 
                "fetch_k": 50,
                "filter": {"title": {"$in": active_sources}}
            }
        )

    # 2. BM25 Retriever (Sparse / Keyword)
    # Note: BM25 needs access to chunks. 
    # In a real large-scale app, we'd persist BM25 index too. 
    # For this portfolio scale, we can rebuild it or just rely on Vector if we don't have docs in memory.
    # PRO TIP: Chroma doesn't easily give us ALL docs to build BM25 cheaply every time.
    # COMPROMISE for 1-day sprint: 
    # If we just loaded docs, we have them. If restarting, we might lack BM25 unless we fetch all from Chroma.
    # Let's fetch all docs from Chroma to build BM25. It's fast for <10k docs.
    
    docs = vectorstore.get()['documents']
    metadatas = vectorstore.get()['metadatas']
    
    if not docs:
        return base_retriever # Fallback to just vector if empty
        
    # Reconstruct Documents for BM25
    bm25_docs = [Document(page_content=t, metadata=m) for t, m in zip(docs, metadatas)]
    
    # Filter BM25 docs if needed
    if active_sources:
        bm25_docs = [d for d in bm25_docs if d.metadata.get("title") in active_sources]
        
    if not bm25_docs:
         return base_retriever

    bm25_retriever = BM25Retriever.from_documents(bm25_docs)
    bm25_retriever.k = 10
    
    # 3. Ensemble (Manual RRF)
    # ensemble_retriever = EnsembleRetriever(...) <- Removed due to import issues
    
    class CustomEnsembleRetriever:
        def __init__(self, retrievers, weights=None):
            self.retrievers = retrievers
            self.weights = weights
            
        def invoke(self, query):
            # Get results from all retrievers
            results = []
            for r in self.retrievers:
                results.append(r.invoke(query))
            
            # Weighted Reciprocal Rank Fusion
            # Simple RRF: score = 1 / (k + rank)
            # We can ignore weights for simplicity or use them to boost RRF constant
            
            k = 60
            scores = {}
            for rank_list in results:
                for rank, doc in enumerate(rank_list):
                    key = doc.page_content # Use content as unique key
                    if key not in scores:
                        scores[key] = {"doc": doc, "score": 0.0}
                    scores[key]["score"] += 1.0 / (k + rank)
            
            # Sort by score
            sorted_items = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
            return [item["doc"] for item in sorted_items]

    return CustomEnsembleRetriever(retrievers=[base_retriever, bm25_retriever])


RAG_PROMPT = ChatPromptTemplate.from_template("""You are a document Q&A assistant. Answer ONLY using the provided context below.

RULES:
1. Every claim MUST cite its source inline as [Source: <title>].
2. If the context does NOT contain the answer, respond EXACTLY:
   "❌ Not in KB yet. To answer this, you would need: <suggest what document or information is needed>"
3. NEVER guess, infer, or use external knowledge.
4. Be concise and accurate.

{history_section}

Context:
{context}

Question: {question}

Answer:""")

def _format_context(docs):
    parts = []
    for d in docs:
        title = d.metadata.get("title", "Unknown")
        source = d.metadata.get("source_url", d.metadata.get("source_file", ""))
        header = f"[Source: {title}]"
        # if source: header += f" ({source})"
        parts.append(f"{header}\n{d.page_content}")
    return "\n\n---\n\n".join(parts)

def query(question: str, history: str = "", filter_list: list[str] | None = None, top_k: int = 5, hybrid: bool = True) -> dict:
    """Run a citation-aware RAG query with Hybrid Search and Re-ranking."""
    vs = get_vectorstore()
    
    # 1. Retrieval
    if hybrid:
        retriever = get_hybrid_retriever(vs, filter_list)
        docs = retriever.invoke(question) # Gets top K from ensemble (typically 10-20)
    else:
        # Standard Vector Search
        search_kwargs = {"k": 20}
        if filter_list:
             search_kwargs["filter"] = {"title": {"$in": filter_list}}
        docs = vs.similarity_search(question, **search_kwargs)

    # 2. Re-ranking (FlashRank)
    # Rerank the top 20 results to find the best 5
    ranker = get_ranker()
    
    passages = [
        {"id": str(i), "text": d.page_content, "meta": d.metadata} 
        for i, d in enumerate(docs)
    ]
    
    rerank_request = RerankRequest(query=question, passages=passages)
    reranked_results = ranker.rerank(rerank_request)
    
    # Select Top K (e.g., 5)
    final_docs = []
    for r in reranked_results[:top_k]:
        # Reconstruct Document
        final_docs.append(Document(page_content=r["text"], metadata=r["meta"]))
        
    context = _format_context(final_docs)
    
    # 3. Generation
    history_section = f"Recent conversation:\n{history}\n" if history else ""
    chain = RAG_PROMPT | get_llm() | StrOutputParser()
    answer = chain.invoke({"context": context, "question": question, "history_section": history_section})
    
    # Clean DeepSeek R1 <think>
    answer = re.sub(r'<think>[\s\S]*?</think>', '', answer).strip()
    in_kb = "not in kb yet" not in answer.lower()

    # Extract Sources
    seen = set()
    sources = []
    for d in final_docs:
        title = d.metadata.get("title", "Unknown")
        if title not in seen:
            seen.add(title)
            sources.append({
                "title": title,
                "url": d.metadata.get("source_url", ""),
                "file": d.metadata.get("source_file", ""),
                "page": d.metadata.get("page", ""),
            })
            
    return {"answer": answer, "sources": sources, "in_kb": in_kb}

def query_stream(question: str, history: str = "", filter_list: list[str] | None = None, top_k: int = 5):
    """Yields stream of answer chunks."""
    # Reuse query logic but for streaming
    # Note: For efficiency, we duplicate retrieval/reranking logic here or extract it
    
    vs = get_vectorstore()
    retriever = get_hybrid_retriever(vs, filter_list)
    docs = retriever.invoke(question)
    
    ranker = get_ranker()
    passages = [{"id": str(i), "text": d.page_content, "meta": d.metadata} for i, d in enumerate(docs)]
    reranked = ranker.rerank(RerankRequest(query=question, passages=passages))
    
    final_docs = [Document(page_content=r["text"], metadata=r["meta"]) for r in reranked[:top_k]]
    context = _format_context(final_docs)
    history_section = f"Recent conversation:\n{history}\n" if history else ""

    # Yield sources
    seen = set()
    sources = []
    for d in final_docs:
        title = d.metadata.get("title", "Unknown")
        if title not in seen:
            seen.add(title)
            sources.append({
                "title": title,
                "url": d.metadata.get("source_url", ""),
                "file": d.metadata.get("source_file", ""),
                "type": d.metadata.get("type", "unknown")
            })
    
    yield json.dumps({"sources": sources}) + "\n"
    
    chain = RAG_PROMPT | get_llm() | StrOutputParser()
    for chunk in chain.stream({"context": context, "question": question, "history_section": history_section}):
        yield chunk

def generate_title(question: str, answer: str) -> str:
    # ... existing implementation ...
    llm = get_llm()
    prompt = f"Provide a brief 3-5 word title for this chat. Do not include 'Title:'.\nQ: {question}\nA: {answer}"
    try:
        title = llm.invoke(prompt).content.strip().replace('"', '')
        return re.sub(r'^(?:\*\*Title:\*\*\s*|Title:\s*)', '', title, flags=re.IGNORECASE).strip()
    except:
        return "New Thread"

