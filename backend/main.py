import os
import pathlib
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
genai.configure(api_key=GEMINI_API_KEY)

from rag.ingestion import delete_document, get_collection, ingest_document, list_documents
from rag.retrieval import retrieve
from rag.generation import generate_answer

DEMO_CORPUS_DIR = pathlib.Path(__file__).parent / "demo_corpus"
ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}


def _seed_demo_corpus():
    """Ingest demo corpus files on first startup (only if collection is empty)."""
    collection = get_collection()
    if collection.count() > 0:
        return
    if not DEMO_CORPUS_DIR.exists():
        return
    for path in DEMO_CORPUS_DIR.iterdir():
        ext = path.suffix.lstrip(".").lower()
        if ext in ALLOWED_EXTENSIONS:
            try:
                stats = ingest_document(path.read_bytes(), path.name)
                print(f"[seed] ingested {path.name} → {stats['chunks']} chunks")
            except Exception as e:
                print(f"[seed] failed to ingest {path.name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_demo_corpus()
    yield


app = FastAPI(title="RAG Knowledge Base API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to your Vercel domain after deploy
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '.{ext}'. Use PDF, TXT, or MD.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB guard
        raise HTTPException(400, "File too large. Max 20 MB.")
    try:
        stats = ingest_document(content, file.filename or "upload")
    except ValueError as e:
        raise HTTPException(422, str(e))
    return stats


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


@app.post("/query")
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty.")
    sources = retrieve(req.question, top_k=req.top_k)
    answer = generate_answer(req.question, sources)
    return {"answer": answer, "sources": sources}


@app.get("/documents")
def documents():
    return list_documents()


@app.delete("/documents/{doc_id}")
def remove_document(doc_id: str):
    removed = delete_document(doc_id)
    if removed == 0:
        raise HTTPException(404, "Document not found.")
    return {"removed_chunks": removed}
