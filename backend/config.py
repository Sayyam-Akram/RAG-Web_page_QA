"""Centralized configuration for the RAG Q&A Assistant."""
import os
from dotenv import load_dotenv

load_dotenv()

# --- LLM (OpenRouter) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
# Default to a FREE model
MODEL = os.getenv("MODEL", "google/gemini-2.0-flash-exp:free") 
BASE_URL = "https://openrouter.ai/api/v1"

# --- Embeddings ---
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# --- RAG Parameters ---
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
RETRIEVER_K = 4
LLM_TEMPERATURE = 0.3
