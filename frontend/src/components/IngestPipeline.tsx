import { useRef, useState } from 'react'
import {
  ingestFileStream,
  type ChunkPreview,
  type EmbeddingPoint,
  type IngestProgressEvent,
  type IngestResponse,
} from '../api/client'
import VectorSpaceGraphic from './VectorSpaceGraphic'

interface Props {
  onIngested: (result: IngestResponse) => void
}

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_CHUNK_OVERLAP = 80
const ALLOWED = ['pdf', 'txt', 'md']

type Status = 'idle' | 'running' | 'done' | 'error'
type TabStatus = 'pending' | 'active' | 'done'

const TABS = ['Upload', 'Chunk', 'Embed'] as const

const STAGE_TO_TAB: Record<string, number> = {
  loading: 0, loaded: 0,
  chunking: 1, chunked: 1,
  embedding: 2, projected: 2, storing: 2,
  done: 2,
}

const STAGE_LABEL: Record<string, string> = {
  loading: 'Loading document…',
  loaded: 'Text extracted',
  chunking: 'Splitting text into chunks…',
  chunked: 'Chunked',
  embedding: 'Embedding chunks…',
  projected: 'Projecting vectors…',
  storing: 'Storing in ChromaDB…',
  done: 'Done',
}

export default function IngestPipeline({ onIngested }: Props) {
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<IngestProgressEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<IngestResponse | null>(null)
  const [chunkPreviews, setChunkPreviews] = useState<ChunkPreview[] | null>(null)
  const [embedPoints, setEmbedPoints] = useState<EmbeddingPoint[] | null>(null)
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE)
  const [chunkOverlap, setChunkOverlap] = useState(DEFAULT_CHUNK_OVERLAP)
  const inputRef = useRef<HTMLInputElement>(null)

  const running = status === 'running'
  const stageStep = STAGE_TO_TAB[progress?.stage ?? 'loading'] ?? 0

  function tabStatus(i: number): TabStatus {
    if (status === 'done') return 'done'
    if (running) {
      if (i < stageStep) return 'done'
      if (i === stageStep) return 'active'
      return 'pending'
    }
    return i < furthest ? 'done' : 'pending'
  }

  function validateFile(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED.includes(ext)) return `Unsupported type .${ext} — use PDF, TXT, or MD`
    if (file.size > 20 * 1024 * 1024) return 'File exceeds 20 MB limit'
    return null
  }

  function onChunkSizeChange(value: number) {
    const size = Number.isFinite(value) ? value : DEFAULT_CHUNK_SIZE
    setChunkSize(size)
    if (chunkOverlap >= size) setChunkOverlap(Math.max(size - 10, 0))
  }

  async function upload(file: File) {
    const fileErr = validateFile(file)
    if (fileErr) { setError(fileErr); setStatus('error'); return }
    if (chunkOverlap >= chunkSize) {
      setError('Chunk overlap must be smaller than chunk size')
      setStatus('error')
      return
    }

    setError(null)
    setLastResult(null)
    setProgress(null)
    setChunkPreviews(null)
    setEmbedPoints(null)
    setFurthest(0)
    setTab(0)
    setStatus('running')

    try {
      const result = await ingestFileStream(
        file,
        { chunkSize, chunkOverlap },
        (event) => {
          setProgress(event)
          const step = STAGE_TO_TAB[event.stage] ?? 0
          setFurthest((f) => Math.max(f, step))
          setTab(step)
          if (event.stage === 'chunked') setChunkPreviews(event.previews ?? [])
          if (event.stage === 'projected') setEmbedPoints(event.points ?? [])
        },
      )
      setLastResult(result)
      setStatus('done')
      setFurthest(2)
      onIngested(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setStatus('error')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  return (
    <div className="pipeline">
      <div className="pipeline-tabs">
        {TABS.map((label, i) => {
          const st = tabStatus(i)
          const clickable = st !== 'pending' || i === 0
          return (
            <button
              key={label}
              type="button"
              className={`pipeline-tab tab-${st}`}
              disabled={!clickable}
              onClick={() => clickable && setTab(i)}
            >
              <span className="pipeline-tab-dot">{st === 'done' ? '✓' : i + 1}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      <div className="pipeline-panel">
        {tab === 0 && (
          <>
            <div className="settings-panel">
              <label className="settings-field">
                <span>Chunk size <em>(chars)</em></span>
                <input
                  type="number"
                  min={50}
                  max={4000}
                  step={50}
                  value={chunkSize}
                  disabled={running}
                  onChange={(e) => onChunkSizeChange(e.target.valueAsNumber)}
                />
              </label>
              <label className="settings-field">
                <span>Overlap <em>(chars)</em></span>
                <input
                  type="number"
                  min={0}
                  max={Math.max(chunkSize - 1, 0)}
                  step={10}
                  value={chunkOverlap}
                  disabled={running}
                  onChange={(e) => setChunkOverlap(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
                />
              </label>
            </div>

            <div
              className={`drop-zone ${dragging ? 'drag-over' : ''} ${running ? 'uploading' : ''}`}
              onClick={() => !running && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,.md"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
              {running && stageStep === 0 ? (
                <div className="upload-loading">
                  <div className="spinner" />
                  <span>{STAGE_LABEL[progress?.stage ?? 'loading']}</span>
                </div>
              ) : (
                <>
                  <div className="upload-icon">⇧</div>
                  <p className="upload-label">Drop a file or <span className="upload-link">browse</span></p>
                  <p className="upload-hint">PDF · TXT · MD &nbsp;·&nbsp; max 20 MB</p>
                </>
              )}
            </div>
          </>
        )}

        {tab === 1 && (
          <div className="chunk-panel">
            <p className="pipeline-subhead">
              chunk size {chunkSize} · overlap {chunkOverlap}
              {chunkPreviews ? ` · ${chunkPreviews.length} chunks` : ''}
            </p>
            {chunkPreviews ? (
              <ol className="chunk-list">
                {chunkPreviews.map((c) => (
                  <li key={c.index} className="chunk-card">
                    <span className="chunk-card-index">{c.index + 1}</span>
                    <span className="chunk-card-text">{c.text}</span>
                  </li>
                ))}
              </ol>
            ) : running && stageStep <= 1 ? (
              <div className="upload-loading">
                <div className="spinner" />
                <span>{STAGE_LABEL[progress?.stage ?? 'chunking']}</span>
              </div>
            ) : (
              <p className="pipeline-empty">Upload a document to see its chunks here.</p>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="embed-panel">
            {embedPoints ? (
              <VectorSpaceGraphic points={embedPoints} previews={chunkPreviews ?? []} />
            ) : running ? (
              <div className="upload-loading">
                <div className="spinner" />
                <span>{STAGE_LABEL[progress?.stage ?? 'embedding']}</span>
              </div>
            ) : (
              <p className="pipeline-empty">Vector embeddings will appear here once processing begins.</p>
            )}

            {running && progress?.stage === 'embedding' && progress.total ? (
              <>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.round(((progress.embedded ?? 0) / progress.total) * 100)}%` }}
                  />
                </div>
                <span className="progress-count">
                  {progress.embedded}/{progress.total} chunks embedded
                  {progress.total_batches && progress.total_batches > 1
                    ? ` (batch ${progress.batch}/${progress.total_batches})`
                    : ''}
                </span>
              </>
            ) : null}

            {status === 'done' && lastResult && (
              <div className="upload-success">
                <span className="check">&#10003;</span>
                <span>
                  <strong>{lastResult.filename}</strong> stored in ChromaDB —{' '}
                  {lastResult.chunks} vectors · {lastResult.embed_model}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="upload-error">{error}</p>}
    </div>
  )
}
