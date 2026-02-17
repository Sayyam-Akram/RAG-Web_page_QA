"""RAG engine: vector store, retriever, and citation-aware QA chain."""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import config as cfg

_embeddings = None
_llm = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=cfg.EMBEDDING_MODEL)
    return _embeddings


def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGoogleGenerativeAI(
            google_api_key=cfg.GOOGLE_API_KEY,
            model=cfg.MODEL,
            temperature=cfg.LLM_TEMPERATURE,
        )
    return _llm


def build_vectorstore(documents):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg.CHUNK_SIZE, chunk_overlap=cfg.CHUNK_OVERLAP
    )
    chunks = splitter.split_documents(documents)
    return FAISS.from_documents(chunks, get_embeddings())


RAG_PROMPT = ChatPromptTemplate.from_template("""You are a document Q&A assistant. Answer ONLY using the provided context below.

RULES:
1. Every claim MUST cite its source inline as [Source: <title>].
2. If the context does NOT contain the answer, respond EXACTLY:
   "❌ Not in KB yet. To answer this, you would need: <suggest what document or information is needed>"
3. NEVER guess, infer, or use external knowledge.
4. Be concise and accurate.
5. Use the conversation history for context about follow-up questions, but still only answer from documents.

{history_section}

Context (with source titles):
{context}

Question: {question}

Answer:""")


def _format_context(docs):
    parts = []
    for d in docs:
        title = d.metadata.get("title", "Unknown")
        source = d.metadata.get("source_url", d.metadata.get("source_file", ""))
        header = f"[Source: {title}]"
        if source:
            header += f" ({source})"
        parts.append(f"{header}\n{d.page_content}")
    return "\n\n---\n\n".join(parts)


def query(retriever, question: str, history: str = "") -> dict:
    """Run a citation-aware RAG query with optional conversation history."""
    retrieved_docs = retriever.invoke(question)
    context = _format_context(retrieved_docs)

    history_section = ""
    if history:
        history_section = f"Recent conversation:\n{history}\n"

    chain = RAG_PROMPT | get_llm() | StrOutputParser()
    answer = chain.invoke({"context": context, "question": question, "history_section": history_section})
    in_kb = "not in kb yet" not in answer.lower()

    seen = set()
    sources = []
    for d in retrieved_docs:
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
