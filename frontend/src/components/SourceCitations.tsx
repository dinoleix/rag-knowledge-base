import { useState } from 'react'
import type { Source } from '../api/client'

interface Props {
  sources: Source[]
}

export default function SourceCitations({ sources }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (sources.length === 0) return null

  return (
    <div className="citations">
      <div className="citations-header">
        <span className="citations-icon">📄</span>
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''} retrieved</span>
      </div>
      <div className="citations-list">
        {sources.map((src, i) => (
          <div
            key={i}
            className={`citation-item ${expanded === i ? 'expanded' : ''}`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="citation-meta">
              <span className="citation-filename">{src.filename}</span>
              <span
                className="citation-score"
                style={{ '--score': `${src.similarity}%` } as React.CSSProperties}
              >
                {src.similarity}% match
              </span>
            </div>
            {expanded === i && (
              <p className="citation-text">{src.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
