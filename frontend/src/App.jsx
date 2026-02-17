import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from './components/ChatMessage'
import './App.css'

const API = '/api'

export default function App() {
    const [threads, setThreads] = useState([])
    const [activeThread, setActiveThread] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState({ ready: false, sources: [] })
    const [drawer, setDrawer] = useState(false)
    const [sourceMode, setSourceMode] = useState('url')
    const [urls, setUrls] = useState('')
    const [files, setFiles] = useState([])
    const [toast, setToast] = useState(null)
    const bottomRef = useRef(null)
    const fileRef = useRef()

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

    useEffect(() => {
        fetch(`${API}/threads`).then(r => r.json()).then(d => setThreads(d.threads || [])).catch(() => { })
        fetch(`${API}/status`).then(r => r.json()).then(setStatus).catch(() => { })
    }, [])

    const refreshThreads = useCallback(async () => {
        const r = await fetch(`${API}/threads`)
        const d = await r.json()
        setThreads(d.threads || [])
    }, [])

    const loadThread = useCallback(async (id) => {
        setActiveThread(id)
        const r = await fetch(`${API}/threads/${id}`)
        const d = await r.json()
        if (d.ok) setMessages(d.thread.messages || [])
    }, [])

    const startNewChat = () => { setActiveThread(null); setMessages([]) }

    const deleteThread = async (id, e) => {
        e.stopPropagation()
        await fetch(`${API}/threads/${id}`, { method: 'DELETE' })
        if (activeThread === id) startNewChat()
        refreshThreads()
    }

    const handleProcess = async () => {
        setToast(null)
        try {
            let res
            if (sourceMode === 'url') {
                if (!urls.trim()) { setToast({ type: 'error', text: 'Enter at least one URL.' }); return }
                res = await fetch(`${API}/load-urls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }) })
            } else {
                if (!files.length) { setToast({ type: 'error', text: 'Upload at least one file.' }); return }
                const form = new FormData()
                files.forEach(f => form.append('files', f))
                res = await fetch(`${API}/upload-files`, { method: 'POST', body: form })
            }
            const data = await res.json()
            if (data.ok) {
                setToast({ type: 'success', text: `Loaded ${data.loaded} chunks from ${data.sources?.length || 0} source(s)` })
                setStatus({ ready: true, sources: data.sources || [] })
                setFiles([])
            } else {
                setToast({ type: 'error', text: data.errors?.join(', ') || 'Failed to load sources.' })
            }
        } catch {
            setToast({ type: 'error', text: 'Connection error — is the backend running?' })
        }
    }

    const send = async (question) => {
        const q = (question || input).trim()
        if (!q || loading || !status.ready) return
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: q }])
        setLoading(true)
        try {
            const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, thread_id: activeThread }) })
            const data = await res.json()
            if (data.ok) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources, in_kb: data.in_kb }])
                if (!activeThread) setActiveThread(data.thread_id)
                refreshThreads()
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Something went wrong.', sources: [], in_kb: true }])
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Could not reach the server.', sources: [], in_kb: true }])
        } finally { setLoading(false) }
    }

    return (
        <div className="app">
            {/* ─── LEFT SIDEBAR ─── */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">⚡</div>
                    <span className="brand">Knowledge Lab</span>
                    <span className="badge">RAG</span>
                </div>

                <button className="new-chat-btn" onClick={startNewChat}>
                    <span className="icon-plus">+</span> New Thread
                </button>

                <div className="thread-section-label">Recent</div>
                <div className="thread-list">
                    {threads.map(t => (
                        <div key={t.id} className={`thread-item ${activeThread === t.id ? 'active' : ''}`} onClick={() => loadThread(t.id)}>
                            <span className="thread-icon">💬</span>
                            <div className="thread-info">
                                <div className="thread-title">{t.title}</div>
                                <div className="thread-meta">{t.message_count} messages</div>
                            </div>
                            <button className="thread-delete" onClick={e => deleteThread(t.id, e)}>✕</button>
                        </div>
                    ))}
                    {threads.length === 0 && <div className="empty-threads">No threads yet — start a conversation</div>}
                </div>

                <div className="sidebar-footer">
                    <button className="source-toggle-btn" onClick={() => setDrawer(!drawer)}>
                        <span className={`dot ${status.ready ? 'active' : 'inactive'}`} />
                        {status.ready ? `${status.sources?.length || 0} Source(s)` : 'Add Sources'}
                    </button>
                </div>
            </aside>

            {/* ─── MAIN AREA ─── */}
            <main className="main-area">
                <div className="status-strip">
                    <span className={`status-dot ${status.ready ? 'on' : 'off'}`} />
                    <span>{status.ready ? `Ready — ${status.sources?.length || 0} source(s) indexed` : 'No sources loaded — add documents to begin'}</span>
                </div>

                <div className="chat-viewport">
                    {messages.length === 0 && (
                        <div className="welcome-screen">
                            <div className="welcome-icon">🔬</div>
                            <h1>Knowledge Lab</h1>
                            <p className="subtitle">
                                Your AI research assistant. Feed it documents or URLs, then ask precise questions — every answer is grounded in your sources.
                            </p>

                            <div className="feature-grid">
                                <div className="feature-card">
                                    <div className="card-icon indigo">📎</div>
                                    <div className="card-title">Source Citations</div>
                                    <div className="card-desc">Every claim traced back to its origin document</div>
                                </div>
                                <div className="feature-card">
                                    <div className="card-icon teal">🧠</div>
                                    <div className="card-title">Thread Memory</div>
                                    <div className="card-desc">Follow-up questions understand prior context</div>
                                </div>
                                <div className="feature-card">
                                    <div className="card-icon rose">🛡️</div>
                                    <div className="card-title">Hallucination Guard</div>
                                    <div className="card-desc">Tells you when the answer isn't in the KB</div>
                                </div>
                            </div>

                            <div className="quick-start">
                                <div className="qs-label">Quick Start</div>
                                <div className="chip-grid">
                                    <button className="suggestion-chip" onClick={() => { setDrawer(true) }}>
                                        <span className="chip-emoji">📄</span> Upload a PDF
                                    </button>
                                    <button className="suggestion-chip" onClick={() => { setDrawer(true); setSourceMode('url') }}>
                                        <span className="chip-emoji">🌐</span> Analyze a URL
                                    </button>
                                    <button className="suggestion-chip" onClick={() => send('What sources are loaded?')} disabled={!status.ready}>
                                        <span className="chip-emoji">📚</span> What's in my KB?
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}

                    {loading && (
                        <div className="msg-row assistant">
                            <div className="msg-inner">
                                <div className="msg-avatar">🔬</div>
                                <div className="msg-body">
                                    <div className="msg-role">Assistant</div>
                                    <div className="typing-dots"><span /><span /><span /></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* ─── FLOATING INPUT ─── */}
                <div className="input-dock">
                    <div className="input-pill">
                        <input
                            placeholder={status.ready ? 'Ask anything about your documents…' : 'Load sources first…'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                            disabled={!status.ready || loading}
                        />
                        <button className="pill-btn" title="Upload file" onClick={() => { setDrawer(true); setSourceMode('file') }}>📎</button>
                        <button className="pill-btn" title="Add URL" onClick={() => { setDrawer(true); setSourceMode('url') }}>🔗</button>
                        <button className="pill-send" onClick={() => send()} disabled={!status.ready || loading || !input.trim()} title="Send">➤</button>
                    </div>
                </div>

                {/* ─── RIGHT DRAWER ─── */}
                {drawer && (
                    <div className="right-drawer">
                        <div className="drawer-header">
                            <h3>Source Manager</h3>
                            <button className="drawer-close" onClick={() => setDrawer(false)}>✕</button>
                        </div>
                        <div className="drawer-body">
                            <div className="mode-toggle">
                                <button className={`mode-btn ${sourceMode === 'url' ? 'active' : ''}`} onClick={() => setSourceMode('url')}>🌐 URLs</button>
                                <button className={`mode-btn ${sourceMode === 'file' ? 'active' : ''}`} onClick={() => setSourceMode('file')}>📄 Files</button>
                            </div>

                            {sourceMode === 'url' ? (
                                <textarea className="url-textarea" placeholder={'Paste URLs, one per line:\nhttps://docs.example.com/guide'} value={urls} onChange={e => setUrls(e.target.value)} />
                            ) : (
                                <>
                                    <div className="drop-zone" onClick={() => fileRef.current?.click()}>
                                        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                                        <div className="drop-icon">📁</div>
                                        <div className="drop-text">Drop files or click to browse</div>
                                        <div className="drop-formats">PDF · DOCX · TXT</div>
                                    </div>
                                    {files.length > 0 && (
                                        <div className="file-chips">
                                            {files.map((f, i) => (
                                                <span key={i} className="file-chip">📄 {f.name} <button className="remove" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>✕</button></span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="drawer-actions">
                                <button className="btn-process" onClick={handleProcess} disabled={loading}>🚀 Process Sources</button>
                            </div>

                            {status.sources?.length > 0 && (
                                <div className="loaded-sources">
                                    <div className="label">Indexed Sources</div>
                                    {status.sources.map((s, i) => (
                                        <span key={i} className="source-tag">{s.type === 'url' ? '🌐' : '📄'} {s.title}</span>
                                    ))}
                                </div>
                            )}

                            {toast && <div className={`drawer-toast ${toast.type}`}>{toast.text}</div>}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
