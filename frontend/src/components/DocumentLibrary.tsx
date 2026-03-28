import { useEffect, useState } from 'react'
import { deleteDocument, listDocuments, type Document } from '../api/client'

interface Props {
  refreshTrigger: number
}

export default function DocumentLibrary({ refreshTrigger }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setDocs(await listDocuments())
    } catch {
      // silently fail — backend may be cold-starting
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshTrigger])

  async function remove(doc_id: string) {
    setDeleting(doc_id)
    try {
      await deleteDocument(doc_id)
      setDocs((prev) => prev.filter((d) => d.doc_id !== doc_id))
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="library">
      <div className="library-header">
        <h3>Knowledge Base</h3>
        <span className="doc-count">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <div className="library-loading"><div className="spinner-sm" /></div>}

      {!loading && docs.length === 0 && (
        <p className="library-empty">No documents yet.<br />Upload a file to get started.</p>
      )}

      <ul className="doc-list">
        {docs.map((doc) => (
          <li key={doc.doc_id} className="doc-item">
            <div className="doc-info">
              <span className="doc-icon">📄</span>
              <div>
                <p className="doc-name">{doc.filename}</p>
                <p className="doc-meta">{doc.chunks} chunks</p>
              </div>
            </div>
            <button
              className="doc-delete"
              onClick={() => remove(doc.doc_id)}
              disabled={deleting === doc.doc_id}
              title="Remove from knowledge base"
            >
              {deleting === doc.doc_id ? '…' : '✕'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
