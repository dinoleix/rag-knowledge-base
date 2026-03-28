import uuid
import io
from typing import Optional
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
def _chunk_text(text: str) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


# ── Public API ───────────────────────────────────────────────────────────────
def ingest_document(file_bytes: bytes, filename: str) -> dict:
    """Parse, chunk, embed, and store a document. Returns stats."""
    text = _extract_text(file_bytes, filename)
    if not text.strip():
        raise ValueError("Could not extract any text from the document.")

    chunks = _chunk_text(text)
    doc_id = str(uuid.uuid4())

    # Batch embed (Gemini allows up to 100 per call)
    embeddings = []
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        result = genai.embed_content(
            model=EMBED_MODEL,
            content=batch,
            task_type="retrieval_document",
        )
        embeddings.extend(result["embedding"])

    collection = get_collection()
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {"doc_id": doc_id, "filename": filename, "chunk_index": i, "text": chunk}
        for i, chunk in enumerate(chunks)
    ]

    collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=chunks)

    return {
        "doc_id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
        "embed_model": EMBED_MODEL,
        "char_count": len(text),
    }


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
