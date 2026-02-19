import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from './components/ChatMessage'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import SettingsModal from './components/SettingsModal'
import { Send, Paperclip, Link2, Sun, Moon } from 'lucide-react'
import './App.css'

const API = '/api'

export default function App() {
    const [threads, setThreads] = useState([])
    const [activeThread, setActiveThread] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState({ ready: false, sources: [] })
    const [sourceMode, setSourceMode] = useState('url')
    const [urls, setUrls] = useState('')
    const [files, setFiles] = useState([])
    const [toast, setToast] = useState(null)
    const [showSources, setShowSources] = useState(false) // Default closed
    const [activeSources, setActiveSources] = useState([])
    const [currentView, setCurrentView] = useState('dashboard') // 'dashboard' | 'chat'
    const [theme, setTheme] = useState('dark')

    // Expert Settings State
    const [showSettings, setShowSettings] = useState(false)
    const [settings, setSettings] = useState({
        top_k: 5,
        temperature: 0.3,
        hybrid_search: true
    })

    const bottomRef = useRef(null)
    const fileRef = useRef()

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

    useEffect(() => {
        fetch(`${API}/threads`).then(r => r.json()).then(d => setThreads(d.threads || [])).catch(() => { })
        fetch(`${API}/status`).then(r => r.json()).then(d => {
            setStatus(d)
            if (d.sources) setActiveSources(d.sources.map(s => s.title))
        }).catch(() => { })

        // Load theme from local storage or default
        const savedTheme = localStorage.getItem('theme') || 'dark'
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)
    }, [])

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
    }

    const refreshThreads = useCallback(async () => {
        const r = await fetch(`${API}/threads`)
        const d = await r.json()
        setThreads(d.threads || [])
    }, [])

    const loadThread = useCallback(async (id) => {
        setActiveThread(id)
        setCurrentView('chat')
        const r = await fetch(`${API}/threads/${id}`)
        const d = await r.json()
        if (d.ok) setMessages(d.thread.messages || [])
    }, [])

    const startNewChat = () => {
        setActiveThread(null)
        setMessages([])
        setCurrentView('chat')
    }

    const deleteThread = async (id, e) => {
        // e.stopPropagation() is handled in Sidebar
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
                // Load newly created sources into active filtering
                const newTitles = data.sources.map(s => s.title)
                setActiveSources(prev => [...new Set([...prev, ...newTitles])])
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
            const res = await fetch(`${API}/chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q,
                    thread_id: activeThread,
                    active_sources: activeSources,
                    // Pass settings
                    top_k: settings.top_k,
                    hybrid_search: settings.hybrid_search,
                    temperature: settings.temperature
                })
            })

            const reader = res.body.getReader()
            const decoder = new TextDecoder()

            setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [], in_kb: true }])

            let buffer = ''
            let isFirstBlock = true

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })

                if (isFirstBlock) {
                    buffer += chunk
                    const newlineIndex = buffer.indexOf('\n')
                    if (newlineIndex !== -1) {
                        const jsonLine = buffer.slice(0, newlineIndex)
                        try {
                            const data = JSON.parse(jsonLine)
                            if (data.error) {
                                setMessages(prev => {
                                    const last = prev[prev.length - 1]
                                    return [...prev.slice(0, -1), { ...last, content: data.error }]
                                })
                                break
                            }
                            if (data.thread_id && !activeThread) setActiveThread(data.thread_id)
                            setMessages(prev => {
                                const last = prev[prev.length - 1]
                                return [...prev.slice(0, -1), {
                                    ...last,
                                    sources: data.sources || [],
                                    in_kb: data.in_kb
                                }]
                            })
                            const remaining = buffer.slice(newlineIndex + 1)
                            buffer = ''
                            isFirstBlock = false
                            if (remaining) {
                                setMessages(prev => {
                                    const last = prev[prev.length - 1]
                                    return [...prev.slice(0, -1), { ...last, content: last.content + remaining }]
                                })
                            }
                        } catch (e) { console.error("JSON parse error", e) }
                    }
                } else {
                    setMessages(prev => {
                        const last = prev[prev.length - 1]
                        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
                    })
                }
            }
            refreshThreads()
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ Could not reach the server.', sources: [], in_kb: true }])
        } finally { setLoading(false) }
    }

    return (
        <div className="app">
            <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                threads={threads}
                activeThread={activeThread}
                onLoadThread={loadThread}
                onDeleteThread={deleteThread}
                onNewChat={startNewChat}
                onToggleSources={() => setShowSources(!showSources)}
                onOpenSettings={() => setShowSettings(true)}
            />

            {/* Main Area */}
            <main className="main-area">

                {/* Top Bar for Theme Toggle (Floating or Fixed) */}
                <div style={{ position: 'absolute', top: '1rem', right: '1.5rem', zIndex: 50 }}>
                    <button onClick={toggleTheme} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>

                {currentView === 'dashboard' ? (
                    <Dashboard
                        status={status}
                        threads={threads}
                        activeSources={activeSources}
                        setActiveSources={setActiveSources}
                        setSourceMode={(mode) => { setSourceMode(mode); setCurrentView('chat'); setShowSources(true); }}
                        setCurrentView={setCurrentView}
                        loadThread={loadThread}
                    />
                ) : (
                    <>
                        <div className="status-strip">
                            <span className={`status-dot ${status.ready ? 'on' : 'off'}`} />
                            <span>{status.ready ? `Ready — ${status.sources?.length || 0} source(s) indexed` : 'No sources loaded'}</span>
                            <button className="toggle-sources-btn" onClick={() => setShowSources(!showSources)} title="Toggle Source Manager">
                                {showSources ? 'Hide Sources ▸' : '◂ Show Sources'}
                            </button>
                        </div>

                        <div className="chat-viewport">
                            {messages.length === 0 && (
                                <div className="welcome-screen">
                                    <div className="welcome-icon">
                                        <img src="/logo.png" alt="Logo" className="welcome-bot-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                                        <div className="welcome-bot-fallback" style={{ display: 'none' }}>⚡</div>
                                    </div>
                                    <h1>CiteFlow</h1>
                                    <div className="brand-sub" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>RESEARCH OS</div>
                                    <p className="subtitle">
                                        Your AI research assistant. Feed it documents or URLs, then ask precise questions — every answer is grounded in your sources.
                                    </p>
                                    <div className="chip-grid">
                                        <button className="suggestion-chip" onClick={() => { setSourceMode('file'); setShowSources(true) }}>📄 Upload PDF</button>
                                        <button className="suggestion-chip" onClick={() => { setSourceMode('url'); setShowSources(true) }}>🔗 Analyze URL</button>
                                    </div>
                                </div>
                            )}
                            {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
                            {loading && <div className="msg-row assistant"><div className="msg-inner"><div className="typing-dots"><span /><span /><span /></div></div></div>}
                            <div ref={bottomRef} />
                        </div>

                        <div className="input-dock">
                            <div className="input-pill">
                                <button className="pill-btn" onClick={() => { setSourceMode('file'); setShowSources(true) }}><Paperclip size={18} /></button>
                                <button className="pill-btn" onClick={() => { setSourceMode('url'); setShowSources(true) }}><Link2 size={18} /></button>
                                <input
                                    placeholder={status.ready ? 'Ask your knowledge base…' : 'Load sources first…'}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                                    disabled={!status.ready || loading}
                                />
                                <button className="pill-send" onClick={() => send()} disabled={!status.ready || loading || !input.trim()}><Send size={18} /></button>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* Right Panel: Source Manager (Only in Chat view or always? Sliding in) */}
            <aside className={`source-manager ${showSources ? '' : 'collapsed'}`}>
                <div className="sm-header">
                    <h3>Source Manager</h3>
                    <button onClick={() => setShowSources(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                </div>
                <div className="sm-body">
                    <div className="mode-toggle">
                        <button className={`mode-btn ${sourceMode === 'url' ? 'active' : ''}`} onClick={() => setSourceMode('url')}>URLS</button>
                        <button className={`mode-btn ${sourceMode === 'file' ? 'active' : ''}`} onClick={() => setSourceMode('file')}>FILES</button>
                    </div>

                    {sourceMode === 'url' ? (
                        <div className="sm-section">
                            <label className="sm-label">Ingest URLs</label>
                            <textarea className="url-textarea" placeholder={'Enter one URL per line…'} value={urls} onChange={e => setUrls(e.target.value)} />
                        </div>
                    ) : (
                        <div className="sm-section">
                            <label className="sm-label">Upload Files</label>
                            <div className="drop-zone" onClick={() => fileRef.current?.click()}>
                                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                                <div className="drop-icon">📁</div>
                                <div className="drop-text">Drop files</div>
                            </div>
                            {files.length > 0 && <div className="file-chips">{files.map((f, i) => <span key={i} className="file-chip">{f.name}</span>)}</div>}
                        </div>
                    )}
                    <button className="btn-process" onClick={handleProcess} disabled={loading}>PROCESS SOURCES</button>

                    {toast && <div className={`sm-toast ${toast.type}`}><div>{toast.text}</div></div>}

                    {status.sources?.length > 0 && (
                        <div className="loaded-sources">
                            <div className="sm-label">Indexed Sources</div>
                            {status.sources.map((s, i) => (
                                <div key={i} className="source-row">
                                    <input type="checkbox" checked={activeSources.includes(s.title)} onChange={e => { if (e.target.checked) setActiveSources(p => [...p, s.title]); else setActiveSources(p => p.filter(t => t !== s.title)) }} />
                                    <span className="source-tag">{s.title}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

            {showSettings && (
                <SettingsModal
                    settings={settings}
                    setSettings={setSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    )
}
// export default App // Not needed, exported default at definition
