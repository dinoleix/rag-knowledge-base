import { useRef, useState } from 'react'
import { ingestFileStream, type IngestProgressEvent, type IngestResponse } from '../api/client'

interface Props {
  onIngested: (result: IngestResponse) => void
}

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_CHUNK_OVERLAP = 80
const ALLOWED = ['pdf', 'txt', 'md']

type Status = 'idle' | 'running' | 'done' | 'error'

const STAGE_LABEL: Record<string, string> = {
  loading: 'Loading document…',
  loaded: 'Text extracted',
  chunking: 'Chunking…',
  chunked: 'Chunked',
  embedding: 'Embedding chunks…',
  storing: 'Storing in ChromaDB…',
  done: 'Done',
}

// Stage order used to render a 4-step progress list
const STEPS = ['loading', 'chunking', 'embedding', 'storing'] as const
const STAGE_TO_STEP: Record<string, number> = {
  loading: 0, loaded: 0,
  chunking: 1, chunked: 1,
  embedding: 2,
  storing: 3,
  done: 4,
}

export default function DocumentUpload({ onIngested }: Props) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<IngestProgressEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<IngestResponse | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE)
  const [chunkOverlap, setChunkOverlap] = useState(DEFAULT_CHUNK_OVERLAP)
  const inputRef = useRef<HTMLInputElement>(null)

  const loading = status === 'running'

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
    setStatus('running')

    try {
      const result = await ingestFileStream(
        file,
        { chunkSize, chunkOverlap },
        (event) => setProgress(event),
      )
      setLastResult(result)
      setStatus('done')
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

  const activeStep = progress ? STAGE_TO_STEP[progress.stage] ?? 0 : -1

  return (
    <div className="upload-section">
      <div className="settings-block">
        <button
          type="button"
          className="settings-toggle"
          onClick={() => setShowSettings((s) => !s)}
          disabled={loading}
        >
          <span>Chunking settings</span>
          <span className="settings-caret">{showSettings ? '▾' : '▸'}</span>
        </button>
        {showSettings && (
          <div className="settings-panel">
            <label className="settings-field">
              <span>Chunk size <em>(chars)</em></span>
              <input
                type="number"
                min={50}
                max={4000}
                step={50}
                value={chunkSize}
                disabled={loading}
                onChange={(e) => onChunkSizeChange(e.target.valueAsNumber)}
              />
            </label>
            <label className="settings-field">
              <span>Chunk overlap <em>(chars)</em></span>
              <input
                type="number"
                min={0}
                max={Math.max(chunkSize - 1, 0)}
                step={10}
                value={chunkOverlap}
                disabled={loading}
                onChange={(e) => setChunkOverlap(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
              />
            </label>
          </div>
        )}
      </div>

      <div
        className={`drop-zone ${dragging ? 'drag-over' : ''} ${loading ? 'uploading' : ''}`}
        onClick={() => !loading && inputRef.current?.click()}
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
        {loading ? (
          <div className="upload-progress">
            <ol className="progress-steps">
              {STEPS.map((step, i) => (
                <li
                  key={step}
                  className={
                    i < activeStep ? 'step-done' : i === activeStep ? 'step-active' : 'step-pending'
                  }
                >
                  <span className="step-dot">{i < activeStep ? '✓' : i + 1}</span>
                  <span className="step-label">{step[0].toUpperCase() + step.slice(1)}</span>
                </li>
              ))}
            </ol>

            <div className="progress-detail">
              <div className="spinner-sm" />
              <span>{STAGE_LABEL[progress?.stage ?? 'loading']}</span>
            </div>

            {progress?.stage === 'embedding' && progress.total ? (
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

            {(progress?.stage === 'chunked' || progress?.stage === 'chunking') && (
              <span className="progress-count">
                {progress.chunks
                  ? `${progress.chunks} chunks created`
                  : `chunk size ${chunkSize} · overlap ${chunkOverlap}`}
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="upload-icon">⇧</div>
            <p className="upload-label">Drop a file or <span className="upload-link">browse</span></p>
            <p className="upload-hint">PDF · TXT · MD &nbsp;·&nbsp; max 20 MB</p>
          </>
        )}
      </div>

      {error && <p className="upload-error">{error}</p>}

      {lastResult && status === 'done' && (
        <div className="upload-success">
          <span className="check">&#10003;</span>
          <span>
            <strong>{lastResult.filename}</strong> ingested —{' '}
            {lastResult.chunks} chunks · {(lastResult.char_count / 1000).toFixed(1)}k chars
          </span>
        </div>
      )}
    </div>
  )
}
