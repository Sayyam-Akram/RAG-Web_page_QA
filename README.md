# 📖 RAG Q&A Assistant

Document-grounded Q&A chatbot with **citations** and **"Not in KB"** detection.  
Upload PDFs/DOCX/TXT or paste webpage URLs → Ask questions → Get cited answers.

## Quick Start

### 1. Backend
```bash
cd backend
cp .env.example .env          # Add your OpenRouter API key
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Features
- ✅ **Citations** — every answer includes `[Source: title]` inline citations
- ✅ **Not in KB** — responds "Not in KB yet" when answer isn't in documents
- ✅ **Multi-URL** — paste multiple URLs (one per line)
- ✅ **File Upload** — PDF, DOCX, TXT with drag-and-drop
- ✅ **Premium UI** — dark theme, glassmorphism, animations

## Tech Stack
| Layer | Tech |
|-------|------|
| Backend | FastAPI + LangChain + FAISS |
| Frontend | React (Vite) |
| LLM | OpenRouter (any model) |
| Embeddings | HuggingFace `all-MiniLM-L6-v2` |

## Test Documents
| Type | URL |
|------|-----|
| 🌐 Webpage | `https://docs.python.org/3/faq/general.html` |
| 🌐 Webpage | `https://en.wikipedia.org/wiki/Machine_learning` |
| 📄 PDF | [US Constitution](https://constitutioncenter.org/media/files/constitution.pdf) |
| 📄 PDF | [Attention Is All You Need](https://arxiv.org/pdf/1706.03762) |
