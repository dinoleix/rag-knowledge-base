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

export interface IngestProgressEvent {
  stage: 'loading' | 'loaded' | 'chunking' | 'chunked' | 'embedding' | 'storing' | 'done' | 'error'
  filename?: string
  char_count?: number
  chunk_size?: number
  chunk_overlap?: number
  chunks?: number
  batch?: number
  total_batches?: number
  embedded?: number
  total?: number
  doc_id?: string
  embed_model?: string
  message?: string
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

export async function ingestFileStream(
  file: File,
  opts: { chunkSize: number; chunkOverlap: number },
  onEvent: (event: IngestProgressEvent) => void,
): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('chunk_size', String(opts.chunkSize))
  form.append('chunk_overlap', String(opts.chunkOverlap))

  const res = await fetch(`${BASE}/ingest/stream`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  if (!res.body) throw new Error('Streaming is not supported by this browser')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: IngestResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      const event = JSON.parse(payload) as IngestProgressEvent
      onEvent(event)
      if (event.stage === 'error') {
        throw new Error(event.message ?? 'Ingestion failed')
      }
      if (event.stage === 'done') {
        finalResult = {
          doc_id: event.doc_id!,
          filename: event.filename!,
          chunks: event.chunks!,
          embed_model: event.embed_model!,
          char_count: event.char_count!,
        }
      }
    }
  }

  if (!finalResult) throw new Error('Stream ended before ingestion completed')
  return finalResult
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
