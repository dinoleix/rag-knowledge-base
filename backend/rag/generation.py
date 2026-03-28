import google.generativeai as genai

MODEL = "models/gemini-2.5-flash"

SYSTEM_PROMPT = """You are a knowledgeable assistant that answers questions strictly based on the provided document excerpts.

Rules:
- Only use information from the provided context below. Do not use prior knowledge.
- If the context doesn't contain enough information to answer, say so clearly.
- Be concise and direct. Cite which document/excerpt your answer comes from when relevant.
- Never fabricate facts."""


def generate_answer(question: str, sources: list[dict]) -> str:
    """Generate an answer grounded in the retrieved source chunks."""
    if not sources:
        return "I couldn't find any relevant information in the knowledge base to answer your question. Please try uploading documents related to your query."

    context_parts = []
    for i, src in enumerate(sources, 1):
        context_parts.append(
            f"[Excerpt {i} — {src['filename']} ({src['similarity']}% match)]\n{src['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""{SYSTEM_PROMPT}

--- CONTEXT ---
{context}
--- END CONTEXT ---

Question: {question}

Answer:"""

    model = genai.GenerativeModel(MODEL)
    response = model.generate_content(prompt)
    return response.text
