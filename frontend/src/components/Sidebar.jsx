import { useState, useRef } from 'react'

export default function Sidebar({ status, onProcess, loading }) {
    const [mode, setMode] = useState('url')
    const [urls, setUrls] = useState('')
    const [files, setFiles] = useState([])
    const [message, setMessage] = useState(null)
    const fileRef = useRef()

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files)
        setFiles(prev => [...prev, ...selected])
    }

    const removeFile = (idx) => {
        setFiles(prev => prev.filter((_, i) => i !== idx))
    }

    const handleProcess = async () => {
        setMessage(null)
        try {
            if (mode === 'url') {
                if (!urls.trim()) { setMessage({ type: 'error', text: 'Enter at least one URL.' }); return }
                const res = await fetch('/api/load-urls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls }),
                })
                const data = await res.json()
                if (data.ok) {
                    setMessage({ type: 'success', text: `Loaded ${data.loaded} chunks!` })
                    onProcess(data.sources || [])
                } else {
                    setMessage({ type: 'error', text: data.errors?.join(', ') || 'Failed to load URLs.' })
                }
            } else {
                if (files.length === 0) { setMessage({ type: 'error', text: 'Upload at least one file.' }); return }
                const form = new FormData()
                files.forEach(f => form.append('files', f))
                const res = await fetch('/api/upload-files', { method: 'POST', body: form })
                const data = await res.json()
                if (data.ok) {
                    setMessage({ type: 'success', text: `Loaded ${data.loaded} chunks!` })
                    setFiles([])
                    onProcess(data.sources || [])
                } else {
                    setMessage({ type: 'error', text: data.errors?.join(', ') || 'Failed to load files.' })
                }
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Is the backend running?' })
        }
    }

    const handleClear = async () => {
        await fetch('/api/clear', { method: 'POST' })
        onProcess([])
        setMessage(null)
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>📖 RAG Q&A</h1>
                <p>Document-grounded answers with citations</p>
            </div>

            {/* Mode toggle */}
            <div className="sidebar-section">
                <h3>Data Source</h3>
                <div className="mode-toggle">
                    <button className={`mode-btn ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>
                        🌐 URLs
                    </button>
                    <button className={`mode-btn ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
                        📄 Files
                    </button>
                </div>

                <div className="input-area">
                    {mode === 'url' ? (
                        <textarea
                            className="url-input"
                            placeholder={'Paste URLs, one per line:\nhttps://docs.python.org/3/faq/general.html'}
                            value={urls}
                            onChange={e => setUrls(e.target.value)}
                        />
                    ) : (
                        <>
                            <div className="file-upload-zone" onClick={() => fileRef.current?.click()}>
                                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={handleFileChange} />
                                <div className="icon">📁</div>
                                <p>Click to upload files</p>
                                <div className="formats">PDF, DOCX, TXT</div>
                            </div>
                            {files.length > 0 && (
                                <div className="file-list">
                                    {files.map((f, i) => (
                                        <div key={i} className="file-item">
                                            <span>📄</span>
                                            <span className="name">{f.name}</span>
                                            <button className="remove" onClick={() => removeFile(i)}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <button className="process-btn" onClick={handleProcess} disabled={loading}>
                    {loading ? '⏳ Processing...' : '🚀 Process Source'}
                </button>

                {message && <div className={`toast ${message.type}`}>{message.text}</div>}
            </div>

            {/* Status */}
            <div className="sidebar-section">
                <h3>Status</h3>
                {status.ready ? (
                    <div className="status-pill ready"><span className="dot" /> Ready to Answer</div>
                ) : (
                    <div className="status-pill waiting"><span className="dot" /> Waiting for Data</div>
                )}
                {status.sources?.length > 0 && (
                    <>
                        <h3 style={{ marginTop: '1rem' }}>Loaded Sources</h3>
                        <div className="source-list">
                            {status.sources.map((s, i) => (
                                <span key={i} className="source-badge">
                                    {s.type === 'url' ? '🌐' : '📄'} {s.title}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Clear */}
            {status.ready && (
                <div className="sidebar-section">
                    <button className="clear-btn" onClick={handleClear}>🗑️ Clear Knowledge Base</button>
                </div>
            )}
        </aside>
    )
}
