import google.generativeai as genai

MODEL = "models/gemini-3.6-flash"

# Gemini's sampling defaults for this model
DEFAULT_TEMPERATURE = 1.0
DEFAULT_TOP_P = 0.95
DEFAULT_TOP_K = 40

SYSTEM_PROMPT = """You are a knowledgeable assistant that answers questions strictly based on the provided document excerpts.

Rules:
- Only use information from the provided context below. Do not use prior knowledge.
- If the context doesn't contain enough information to answer, say so clearly.
- Be concise and direct. Cite which document/excerpt your answer comes from when relevant.
- Never fabricate facts."""


def generate_answer(
    question: str,
    sources: list[dict],
    temperature: float = DEFAULT_TEMPERATURE,
    top_p: float = DEFAULT_TOP_P,
    top_k: int = DEFAULT_TOP_K,
) -> str:
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
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
        ),
    )
    return response.text
