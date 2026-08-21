import json
import os
import pathlib
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
genai.configure(api_key=GEMINI_API_KEY)

from rag.ingestion import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    delete_document,
    get_collection,
    ingest_document,
    ingest_document_events,
    list_documents,
)
from rag.retrieval import retrieve
from rag.generation import (
    DEFAULT_TEMPERATURE,
    DEFAULT_TOP_K,
    DEFAULT_TOP_P,
    generate_answer,
)

MIN_CHUNK_SIZE, MAX_CHUNK_SIZE = 50, 4000
MIN_TEMPERATURE, MAX_TEMPERATURE = 0.0, 2.0
MIN_TOP_P, MAX_TOP_P = 0.0, 1.0
MIN_GEN_TOP_K, MAX_GEN_TOP_K = 1, 100


def _validate_chunk_settings(chunk_size: int, chunk_overlap: int) -> None:
    if not (MIN_CHUNK_SIZE <= chunk_size <= MAX_CHUNK_SIZE):
        raise HTTPException(422, f"chunk_size must be between {MIN_CHUNK_SIZE} and {MAX_CHUNK_SIZE} characters.")
    if not (0 <= chunk_overlap < chunk_size):
        raise HTTPException(422, "chunk_overlap must be >= 0 and less than chunk_size.")


def _validate_generation_settings(temperature: float, top_p: float, gen_top_k: int) -> None:
    if not (MIN_TEMPERATURE <= temperature <= MAX_TEMPERATURE):
        raise HTTPException(422, f"gen_temperature must be between {MIN_TEMPERATURE} and {MAX_TEMPERATURE}.")
    if not (MIN_TOP_P <= top_p <= MAX_TOP_P):
        raise HTTPException(422, f"gen_top_p must be between {MIN_TOP_P} and {MAX_TOP_P}.")
    if not (MIN_GEN_TOP_K <= gen_top_k <= MAX_GEN_TOP_K):
        raise HTTPException(422, f"gen_top_k must be between {MIN_GEN_TOP_K} and {MAX_GEN_TOP_K}.")

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
async def ingest(
    file: UploadFile = File(...),
    chunk_size: int = Form(CHUNK_SIZE),
    chunk_overlap: int = Form(CHUNK_OVERLAP),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '.{ext}'. Use PDF, TXT, or MD.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB guard
        raise HTTPException(400, "File too large. Max 20 MB.")
    _validate_chunk_settings(chunk_size, chunk_overlap)
    try:
        stats = ingest_document(content, file.filename or "upload", chunk_size, chunk_overlap)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return stats


@app.post("/ingest/stream")
async def ingest_stream(
    file: UploadFile = File(...),
    chunk_size: int = Form(CHUNK_SIZE),
    chunk_overlap: int = Form(CHUNK_OVERLAP),
):
    """Same as /ingest but streams progress events (loading/chunking/embedding/storing/done)
    as Server-Sent Events, so the client can render live pipeline progress."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '.{ext}'. Use PDF, TXT, or MD.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB guard
        raise HTTPException(400, "File too large. Max 20 MB.")
    _validate_chunk_settings(chunk_size, chunk_overlap)
    filename = file.filename or "upload"

    def event_stream():
        try:
            for event in ingest_document_events(content, filename, chunk_size, chunk_overlap):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5  # number of chunks to retrieve
    # Gemini generation-sampling controls (distinct from retrieval top_k above)
    gen_temperature: float = DEFAULT_TEMPERATURE
    gen_top_p: float = DEFAULT_TOP_P
    gen_top_k: int = DEFAULT_TOP_K


@app.post("/query")
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty.")
    _validate_generation_settings(req.gen_temperature, req.gen_top_p, req.gen_top_k)
    sources = retrieve(req.question, top_k=req.top_k)
    answer = generate_answer(
        req.question, sources, req.gen_temperature, req.gen_top_p, req.gen_top_k
    )
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
