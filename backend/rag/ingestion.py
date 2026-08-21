import uuid
import io
from typing import Optional
import numpy as np
import google.generativeai as genai
import chromadb
from chromadb.config import Settings

# ── Chroma singleton ────────────────────────────────────────────────────────
_client: Optional[chromadb.Client] = None
_collection = None

COLLECTION_NAME = "rag_documents"
EMBED_MODEL = "models/gemini-embedding-001"
CHUNK_SIZE = 500        # characters (≈125 tokens)
CHUNK_OVERLAP = 80


def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path="./chroma_store",
            settings=Settings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ── Text extraction ──────────────────────────────────────────────────────────
def _extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    # txt / md / plain text
    return file_bytes.decode("utf-8", errors="replace")


# ── Chunking ─────────────────────────────────────────────────────────────────
def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0
    step = max(chunk_size - chunk_overlap, 1)
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += step
    return chunks


EMBED_BATCH_SIZE = 50
PREVIEW_CHARS = 220


def _project_2d(embeddings: list[list[float]]) -> list[tuple[float, float]]:
    """Project embedding vectors to 2D via PCA, scaled to roughly [-1, 1], so
    semantically similar chunks land close together on a scatter plot."""
    arr = np.array(embeddings, dtype=np.float64)
    if arr.shape[0] < 2:
        return [(0.0, 0.0) for _ in range(arr.shape[0])]

    centered = arr - arr.mean(axis=0)
    u, s, _vt = np.linalg.svd(centered, full_matrices=False)
    coords = u[:, :2] * s[:2]

    max_abs = np.max(np.abs(coords))
    if max_abs > 0:
        coords = coords / max_abs
    return [(float(x), float(y)) for x, y in coords]


# ── Public API ───────────────────────────────────────────────────────────────
def ingest_document_events(
    file_bytes: bytes,
    filename: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
):
    """Parse, chunk, embed, and store a document, yielding progress events at each stage."""
    yield {"stage": "loading", "filename": filename}
    text = _extract_text(file_bytes, filename)
    if not text.strip():
        yield {"stage": "error", "message": "Could not extract any text from the document."}
        return
    yield {"stage": "loaded", "char_count": len(text)}

    yield {"stage": "chunking", "chunk_size": chunk_size, "chunk_overlap": chunk_overlap}
    chunks = _chunk_text(text, chunk_size, chunk_overlap)
    if not chunks:
        yield {"stage": "error", "message": "Chunking produced no chunks."}
        return
    previews = [
        {"index": i, "text": chunk[:PREVIEW_CHARS] + ("…" if len(chunk) > PREVIEW_CHARS else "")}
        for i, chunk in enumerate(chunks)
    ]
    yield {"stage": "chunked", "chunks": len(chunks), "previews": previews}

    doc_id = str(uuid.uuid4())

    # Batch embed (Gemini allows up to 100 per call)
    embeddings = []
    total_batches = (len(chunks) + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE
    for batch_num, i in enumerate(range(0, len(chunks), EMBED_BATCH_SIZE), start=1):
        batch = chunks[i : i + EMBED_BATCH_SIZE]
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=batch,
            task_type="retrieval_document",
        )
        embeddings.extend(result["embedding"])
        yield {
            "stage": "embedding",
            "batch": batch_num,
            "total_batches": total_batches,
            "embedded": len(embeddings),
            "total": len(chunks),
        }

    points = _project_2d(embeddings)
    yield {
        "stage": "projected",
        "points": [{"index": i, "x": x, "y": y} for i, (x, y) in enumerate(points)],
    }

    yield {"stage": "storing"}
    collection = get_collection()
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {"doc_id": doc_id, "filename": filename, "chunk_index": i, "text": chunk}
        for i, chunk in enumerate(chunks)
    ]

    collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=chunks)

    yield {
        "stage": "done",
        "doc_id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
        "embed_model": EMBED_MODEL,
        "char_count": len(text),
    }


def ingest_document(
    file_bytes: bytes,
    filename: str,
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
) -> dict:
    """Parse, chunk, embed, and store a document. Returns final stats (non-streaming)."""
    result = None
    for event in ingest_document_events(file_bytes, filename, chunk_size, chunk_overlap):
        if event["stage"] == "error":
            raise ValueError(event["message"])
        if event["stage"] == "done":
            result = event
    return {k: v for k, v in result.items() if k != "stage"}


def list_documents() -> list[dict]:
    """Return unique documents (aggregated from chunk metadata)."""
    collection = get_collection()
    total = collection.count()
    if total == 0:
        return []

    results = collection.get(include=["metadatas"], limit=total)
    seen: dict[str, dict] = {}
    for meta in results["metadatas"]:
        doc_id = meta["doc_id"]
        if doc_id not in seen:
            seen[doc_id] = {"doc_id": doc_id, "filename": meta["filename"], "chunks": 0}
        seen[doc_id]["chunks"] += 1
    return list(seen.values())


def delete_document(doc_id: str) -> int:
    """Delete all chunks for a given doc_id. Returns number of chunks removed."""
    collection = get_collection()
    results = collection.get(where={"doc_id": doc_id}, include=["metadatas"])
    ids = results["ids"]
    if ids:
        collection.delete(ids=ids)
    return len(ids)
