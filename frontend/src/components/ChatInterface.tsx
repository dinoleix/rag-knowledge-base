import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { queryKB, DEFAULT_GENERATION_PARAMS, type GenerationParams, type Source } from '../api/client'
import SourceCitations from './SourceCitations'
import SemanticSearchGraphic from './SemanticSearchGraphic'
import SamplingControls from './SamplingControls'

interface Message {
  role: 'user' | 'assistant'
  content: string
  question?: string
  sources?: Source[]
  loading?: boolean
  profileLabel?: string
  genParams?: GenerationParams
}

const DEMO_QUESTIONS = [
  'What is RAG and how does it work?',
  'What is the difference between fine-tuning and prompting?',
  'What are the best practices for enterprise cloud strategy?',
  'How does ChromaDB compare to Pinecone?',
  'What is ITIL and why does it matter?',
]

const CREATIVE_PRESET: GenerationParams = { temperature: 1.6, topP: 0.98, topK: 80 }

function fmtParams(p: GenerationParams) {
  return `temp ${p.temperature.toFixed(2)} · top-p ${p.topP.toFixed(2)} · top-k ${p.topK}`
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I\'m your RAG-powered assistant. Ask me anything about the documents in the knowledge base — I\'ll retrieve the most relevant passages and answer based on them, with full source citations.',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [genParams, setGenParams] = useState<GenerationParams>(DEFAULT_GENERATION_PARAMS)
  const [genParamsB, setGenParamsB] = useState<GenerationParams>(CREATIVE_PRESET)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  async function send(question: string) {
    if (!question.trim() || busy) return
    const q = question.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setBusy(true)

    if (compareMode) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: q },
        { role: 'assistant', content: '', loading: true, profileLabel: 'A' },
        { role: 'assistant', content: '', loading: true, profileLabel: 'B' },
      ])
      try {
        const [resA, resB] = await Promise.all([
          queryKB(q, 5, genParams),
          queryKB(q, 5, genParamsB),
        ])
        setMessages((prev) => [
          ...prev.slice(0, -2),
          { role: 'assistant', content: resA.answer, question: q, sources: resA.sources, profileLabel: 'A', genParams },
          { role: 'assistant', content: resB.answer, question: q, sources: resB.sources, profileLabel: 'B', genParams: genParamsB },
        ])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Something went wrong.'
        setMessages((prev) => [
          ...prev.slice(0, -2),
          { role: 'assistant', content: `Error: ${msg}` },
        ])
      } finally {
        setBusy(false)
      }
      return
    }

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '', loading: true },
    ])
    try {
      const result = await queryKB(q, 5, genParams)
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: result.answer, question: q, sources: result.sources, genParams },
      ])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${msg}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="chat">
      {/* Demo questions */}
      {messages.length === 1 && (
        <div className="demo-questions">
          <p className="demo-label">Try asking:</p>
          <div className="demo-chips">
            {DEMO_QUESTIONS.map((q) => (
              <button key={q} className="demo-chip" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? 'U' : 'AI'}
            </div>
            <div className="message-body">
              {msg.loading ? (
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              ) : (
                <>
                  {msg.role === 'assistant' && msg.genParams && (
                    <div className="gen-params-badge">
                      {msg.profileLabel && <strong>Profile {msg.profileLabel}</strong>}
                      <span>{fmtParams(msg.genParams)}</span>
                    </div>
                  )}
                  <div className="message-text">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <>
                      <SemanticSearchGraphic query={msg.question ?? ''} sources={msg.sources} />
                      <SourceCitations sources={msg.sources} />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Sampling settings */}
      <div className="sampling-block">
        <button
          type="button"
          className="settings-toggle"
          onClick={() => setShowSettings((s) => !s)}
        >
          <span>Generation sampling (temperature / top-p / top-k)</span>
          <span className="settings-caret">{showSettings ? '▾' : '▸'}</span>
        </button>
        {showSettings && (
          <div className="sampling-panel">
            <label className="compare-toggle">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
              />
              <span>Compare A vs B — send the same question through both profiles at once</span>
            </label>
            <div className={compareMode ? 'sampling-columns' : undefined}>
              <SamplingControls label={compareMode ? 'Profile A' : 'Sampling'} params={genParams} onChange={setGenParams} disabled={busy} />
              {compareMode && (
                <SamplingControls label="Profile B" params={genParamsB} onChange={setGenParamsB} disabled={busy} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="input-bar">
        <textarea
          ref={textareaRef}
          className="input-field"
          placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => { setInput(e.target.value); autoResize() }}
          onKeyDown={onKeyDown}
          disabled={busy}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
        >
          {busy ? <div className="spinner-sm" /> : '➤'}
        </button>
      </div>
    </div>
  )
}
