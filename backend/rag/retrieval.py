import google.generativeai as genai
from .ingestion import get_collection, EMBED_MODEL


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """Embed query and return top_k most relevant chunks with similarity scores."""
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=query,
        task_type="retrieval_query",
    )
    query_embedding = result["embedding"]

    collection = get_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["metadatas", "documents", "distances"],
    )

    sources = []
    for i, (meta, doc, dist) in enumerate(
        zip(
            results["metadatas"][0],
            results["documents"][0],
            results["distances"][0],
        )
    ):
        # Chroma cosine distance → similarity: 1 - distance
        similarity = round((1 - dist) * 100, 1)
        sources.append(
            {
                "chunk_index": i,
                "filename": meta["filename"],
                "doc_id": meta["doc_id"],
                "text": doc,
                "similarity": similarity,
            }
        )
    return sources
