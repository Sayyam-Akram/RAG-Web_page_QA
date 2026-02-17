"""Centralized configuration for the RAG Q&A Assistant."""
import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM (Google Gemini) ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MODEL = os.getenv("MODEL", "gemini-1.5-flash")

# --- Embeddings ---
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# --- RAG Parameters ---
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
RETRIEVER_K = 4
LLM_TEMPERATURE = 0.3
