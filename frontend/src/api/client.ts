const BASE = import.meta.env.VITE_API_URL ?? '/api'

export interface Source {
  chunk_index: number
  filename: string
  doc_id: string
  text: string
  similarity: number
}

export interface QueryResponse {
  answer: string
  sources: Source[]
}

export interface IngestResponse {
  doc_id: string
  filename: string
  chunks: number
  embed_model: string
  char_count: number
}

export interface Document {
  doc_id: string
  filename: string
  chunks: number
}

export async function queryKB(question: string, top_k = 5): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, top_k }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function ingestFile(file: File): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/ingest`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteDocument(doc_id: string): Promise<void> {
  const res = await fetch(`${BASE}/documents/${doc_id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
