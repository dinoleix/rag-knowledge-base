import type { ChunkPreview, EmbeddingPoint } from '../api/client'

interface Props {
  points: EmbeddingPoint[]
  previews: ChunkPreview[]
}

const SIZE = 260
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 24

export default function VectorSpaceGraphic({ points, previews }: Props) {
  const previewByIndex = new Map(previews.map((p) => [p.index, p.text]))

  return (
    <div className="vector-graphic">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="vector-svg" role="img" aria-label="2D projection of chunk embeddings">
        {[0.33, 0.66, 1].map((f) => (
          <circle key={f} cx={CENTER} cy={CENTER} r={RADIUS * f} className="vector-ring" />
        ))}
        <line x1={CENTER} y1={CENTER - RADIUS} x2={CENTER} y2={CENTER + RADIUS} className="vector-axis" />
        <line x1={CENTER - RADIUS} y1={CENTER} x2={CENTER + RADIUS} y2={CENTER} className="vector-axis" />

        {points.map((p) => {
          const cx = CENTER + p.x * RADIUS
          const cy = CENTER - p.y * RADIUS
          const delay = Math.min(p.index * 12, 500)
          return (
            <circle
              key={p.index}
              cx={cx}
              cy={cy}
              r={5}
              className="vector-dot"
              style={{ animationDelay: `${delay}ms` }}
            >
              <title>Chunk {p.index + 1}: {previewByIndex.get(p.index) ?? ''}</title>
            </circle>
          )
        })}
      </svg>
      <p className="vector-caption">
        Each dot is one chunk's real embedding vector, projected to 2D (PCA) — chunks with
        similar meaning land closer together. Hover a dot to see its text.
      </p>
    </div>
  )
}
