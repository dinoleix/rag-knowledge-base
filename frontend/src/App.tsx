import { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import DocumentLibrary from './components/DocumentLibrary'
import IngestPipeline from './components/IngestPipeline'
import type { IngestResponse } from './api/client'

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  function onIngested(_result: IngestResponse) {
    setRefreshTrigger((n) => n + 1)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◆</span>
            <span className="logo-text">RAG Knowledge Base</span>
          </div>
          <div className="header-badges">
            <span className="badge">Gemini 2.5 Flash</span>
            <span className="badge">ChromaDB</span>
            <span className="badge">FastAPI</span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="main">
        {/* Sidebar */}
        <aside className="sidebar">
          <IngestPipeline onIngested={onIngested} />
          <DocumentLibrary refreshTrigger={refreshTrigger} />

          <div className="tech-note">
            <p className="tech-note-title">How it works</p>
            <ol className="tech-note-steps">
              <li>Documents are chunked &amp; embedded via <strong>gemini-embedding-001</strong></li>
              <li>Vectors stored in <strong>ChromaDB</strong> (cosine similarity)</li>
              <li>Your query is embedded and top-k chunks retrieved</li>
              <li><strong>Gemini 2.5 Flash</strong> answers using only retrieved context</li>
            </ol>
          </div>
        </aside>

        {/* Chat */}
        <section className="chat-panel">
          <ChatInterface />
        </section>
      </main>
    </div>
  )
}
