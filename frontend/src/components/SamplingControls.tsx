import type { GenerationParams } from '../api/client'

interface Props {
  label: string
  params: GenerationParams
  onChange: (params: GenerationParams) => void
  disabled?: boolean
}

const PRESETS: { name: string; params: GenerationParams }[] = [
  { name: 'Focused', params: { temperature: 0.2, topP: 0.5, topK: 5 } },
  { name: 'Balanced', params: { temperature: 1.0, topP: 0.95, topK: 40 } },
  { name: 'Creative', params: { temperature: 1.6, topP: 0.98, topK: 80 } },
]

export default function SamplingControls({ label, params, onChange, disabled }: Props) {
  return (
    <div className="sampling-group">
      <div className="sampling-group-header">
        <span>{label}</span>
        <div className="sampling-presets">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="sampling-preset"
              disabled={disabled}
              onClick={() => onChange(p.params)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <label className="sampling-field">
        <span>Temperature <em>{params.temperature.toFixed(2)}</em></span>
        <input
          type="range" min={0} max={2} step={0.05}
          value={params.temperature} disabled={disabled}
          onChange={(e) => onChange({ ...params, temperature: Number(e.target.value) })}
        />
      </label>
      <label className="sampling-field">
        <span>Top-P <em>{params.topP.toFixed(2)}</em></span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.topP} disabled={disabled}
          onChange={(e) => onChange({ ...params, topP: Number(e.target.value) })}
        />
      </label>
      <label className="sampling-field">
        <span>Top-K <em>{params.topK}</em></span>
        <input
          type="range" min={1} max={100} step={1}
          value={params.topK} disabled={disabled}
          onChange={(e) => onChange({ ...params, topK: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}
