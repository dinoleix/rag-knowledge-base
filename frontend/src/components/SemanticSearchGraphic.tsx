import type { Source } from '../api/client'

interface Props {
  query: string
  sources: Source[]
}

const SIZE = 260
const CENTER = SIZE / 2
const MAX_R = SIZE / 2 - 30
const MIN_R = 46

export default function SemanticSearchGraphic({ query, sources }: Props) {
  return (
    <div className="search-graphic">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="search-svg" role="img" aria-label="Semantic search: query vs. retrieved chunks">
        {sources.map((src, i) => {
          const angle = (i / sources.length) * 2 * Math.PI - Math.PI / 2
          // higher similarity → smaller radius → closer to the query
          const r = MIN_R + (1 - src.similarity / 100) * (MAX_R - MIN_R)
          const cx = CENTER + r * Math.cos(angle)
          const cy = CENTER + r * Math.sin(angle)
          const strength = src.similarity / 100

          return (
            <g key={i}>
              <line
                x1={CENTER} y1={CENTER} x2={cx} y2={cy}
                className="search-link"
                style={{ opacity: 0.25 + strength * 0.6, strokeWidth: 1 + strength * 2 }}
              />
              <circle
                cx={cx} cy={cy} r={7 + strength * 6}
                className="search-node"
                style={{ opacity: 0.5 + strength * 0.5 }}
              >
                <title>{src.filename} — {src.similarity}% match{'\n'}{src.text}</title>
              </circle>
              <text x={cx} y={cy} className="search-node-label" textAnchor="middle" dominantBaseline="central">
                {i + 1}
              </text>
            </g>
          )
        })}

        <circle cx={CENTER} cy={CENTER} r={20} className="search-query-node">
          <title>Your query: {query}</title>
        </circle>
        <text x={CENTER} y={CENTER} className="search-query-label" textAnchor="middle" dominantBaseline="central">
          Q
        </text>
      </svg>
      <p className="search-caption">
        Your query embedded and compared against every stored chunk — closer nodes were
        more semantically similar and won the top-{sources.length} retrieval.
      </p>
    </div>
  )
}
