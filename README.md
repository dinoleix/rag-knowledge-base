<div align="center">

# 🧠 RAG Knowledge Base

### *Ask questions. Get answers. Grounded in your documents.*

![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-FF6B35?style=for-the-badge&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)

**Live Demo:** [rag-knowledge-base-three.vercel.app](https://rag-knowledge-base-three.vercel.app)

> A full-stack **Retrieval-Augmented Generation (RAG)** application. Upload your own documents — PDFs, text files, or Markdown — and ask natural-language questions. Powered by Google Gemini for generation and ChromaDB for semantic vector search.

</div>

---

## ✨ Features

- 📄 **Multi-format ingestion** — Upload PDF, TXT, and Markdown files up to 20 MB
- 🔍 **Semantic search** — ChromaDB stores document embeddings for high-quality context retrieval
- 🤖 **AI-generated answers** — Google Gemini synthesizes answers grounded in your uploaded sources
- 📚 **Source attribution** — Every answer includes the exact document chunks it was derived from
- 🗂️ **Document management** — View all ingested documents and remove them individually
- 🌱 **Demo corpus** — Pre-loaded sample documents so the app works out of the box on first boot
- ⚡ **Fast async API** — Built on FastAPI with async ingestion and uvicorn for high throughput
- 🌐 **Deployed & ready** — Backend on Render, frontend on Vercel with one-command local dev

---

## 🏗 Architecture

```
┌──────────────────────────────┐      ┌────────────────────────────────────┐
│         Frontend             │      │            Backend (FastAPI)        │
│   React + TypeScript + Vite  │◄────►│                                    │
│   Deployed on Vercel         │      │  ┌─────────┐  ┌────────────────┐ │
└──────────────────────────────┘      │  │Ingestion│  │    Retrieval     │ │
                                      │  │  (PDF /  │  │  (ChromaDB       │ │
                                      │  │ TXT/MD) │  │  vector search)  │ │
                                      │  └────┬────┘  └────────┬─────────┘ │
                                      │       │                │           │
                                      │  ┌────▼────────────────▼────────┐ │
                                      │  │        ChromaDB (local)       │ │
                                      │  └────────────────────┬──────────┘ │
                                      │                       │            │
                                      │  ┌────────────────────▼──────────┐ │
                                      │  │     Google Gemini (LLM)       │ │
                                      │  │     Answer Generation         │ │
                                      │  └───────────────────────────────┘ │
                                      └────────────────────────────────────┘
```

### The RAG Pipeline

1. **Ingest** — Uploaded files are parsed (PyMuPDF for PDFs, plain text for TXT/MD), split into chunks, embedded, and stored in ChromaDB.
2. **Retrieve** — When a question arrives, ChromaDB performs a semantic similarity search and returns the top-K most relevant chunks.
3. **Generate** — The retrieved chunks are passed as grounding context to Google Gemini, which produces a cited, factual answer.

---

## 🛠 Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 18 + TypeScript | Single-page UI for querying and document management |
| **Bundler** | Vite 5 | Fast HMR dev server and optimised production build |
| **Markdown** | react-markdown | Renders AI answers with full Markdown formatting |
| **Backend** | FastAPI + Python | Async REST API — ingest, query, list, delete |
| **Server** | Uvicorn | ASGI server for production and local development |
| **Vector DB** | ChromaDB | Local persistent vector store for embeddings |
| **LLM / AI** | Google Gemini | Answer generation grounded in retrieved context |
| **PDF Parsing** | PyMuPDF (fitz) | Extracts text from uploaded PDF documents |
| **Config** | python-dotenv | Environment variable management |
| **Backend Deploy** | Render | Auto-deploy from `render.yaml` |
| **Frontend Deploy** | Vercel | CDN-hosted SPA with custom routing via `vercel.json` |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{"status": "ok"}` |
| `POST` | `/ingest` | Upload a file (multipart/form-data) to ingest into the knowledge base |
| `POST` | `/query` | Ask a question: `{"question": "...", "top_k": 5}` |
| `GET` | `/documents` | List all ingested document IDs and metadata |
| `DELETE` | `/documents/{doc_id}` | Remove a document and all its chunks from the store |

### Example Query

```bash
curl -X POST https://your-api.onrender.com/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the key points in the uploaded report?", "top_k": 5}'
```

```json
{
  "answer": "Based on the uploaded report, the key points are...",
  "sources": [
    { "doc_id": "report.pdf", "chunk": "...", "score": 0.91 }
  ]
}
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/) API key (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/dinoleix/rag-knowledge-base.git
cd rag-knowledge-base
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

```bash
# Start the API server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

> **Demo corpus:** On first startup, if the ChromaDB collection is empty, the server automatically ingests all files found in `backend/demo_corpus/` so you can query immediately.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be live at `http://localhost:5173`.

---

## ☁️ Deployment

### Backend → Render

The `backend/render.yaml` provides a one-click deploy configuration:

```yaml
services:
  - type: web
    name: rag-knowledge-base-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GEMINI_API_KEY
        sync: false  # set manually in the Render dashboard
    autoDeploy: true
```

Set the `GEMINI_API_KEY` environment variable in your Render service dashboard after connecting the repo.

### Frontend → Vercel

Import the `frontend/` directory into Vercel. The included `vercel.json` handles SPA routing automatically. Set `VITE_API_URL` in Vercel's environment variables to point to your deployed Render backend URL.

---

## 📁 Project Structure

```
rag-knowledge-base/
├── backend/
│   ├── rag/
│   │   ├── ingestion.py      # Document parsing, chunking & embedding
│   │   ├── retrieval.py      # ChromaDB semantic search
│   │   ├── generation.py     # Gemini answer synthesis
│   │   └── __init__.py
│   ├── demo_corpus/          # Sample documents auto-ingested on first boot
│   ├── main.py               # FastAPI app, routes & lifespan
│   ├── requirements.txt      # Python dependencies
│   ├── render.yaml           # Render deployment config
│   └── .env.example          # Environment variable template
└── frontend/
    ├── src/                  # React + TypeScript source
    ├── index.html
    ├── vite.config.ts        # Vite build configuration
    ├── vercel.json           # Vercel SPA routing config
    └── package.json          # Node dependencies
```

---

## 🔒 File Constraints

| Constraint | Limit |
|---|---|
| Supported formats | `.pdf`, `.txt`, `.md` |
| Max file size | 20 MB per upload |
| Default retrieval depth | Top 5 chunks per query |

---

<div align="center">

**Upload. Ask. Understand.**

*Built with FastAPI · ChromaDB · Google Gemini · React*

</div>
