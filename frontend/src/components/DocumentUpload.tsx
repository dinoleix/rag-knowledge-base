import { useRef, useState } from 'react'
import { ingestFile, type IngestResponse } from '../api/client'

interface Props {
  onIngested: (result: IngestResponse) => void
}

export default function DocumentUpload({ onIngested }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<IngestResponse | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED = ['pdf', 'txt', 'md']

  function validateFile(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED.includes(ext)) return `Unsupported type .${ext} — use PDF, TXT, or MD`
    if (file.size > 20 * 1024 * 1024) return 'File exceeds 20 MB limit'
    return null
  }

  async function upload(file: File) {
    const err = validateFile(file)
    if (err) { setError(err); return }
    setError(null)
    setLastResult(null)
    setLoading(true)
    try {
      const result = await ingestFile(file)
      setLastResult(result)
      onIngested(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
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
    <div className="upload-section">
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
          <div className="upload-loading">
            <div className="spinner" />
            <span>Processing…</span>
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

      {lastResult && (
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
