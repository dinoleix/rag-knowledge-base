import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { queryKB, type Source } from '../api/client'
import SourceCitations from './SourceCitations'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  loading?: boolean
}

const DEMO_QUESTIONS = [
  'What is RAG and how does it work?',
  'What is the difference between fine-tuning and prompting?',
  'What are the best practices for enterprise cloud strategy?',
  'How does ChromaDB compare to Pinecone?',
  'What is ITIL and why does it matter?',
]

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

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '', loading: true },
    ])
    setBusy(true)

    try {
      const result = await queryKB(q)
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: result.answer, sources: result.sources },
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
                  <div className="message-text">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <SourceCitations sources={msg.sources} />
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
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
