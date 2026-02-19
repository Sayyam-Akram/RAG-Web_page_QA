import ReactMarkdown from 'react-markdown'

export default function ChatMessage({ msg }) {
    const { role, content, sources, in_kb } = msg

    return (
        <div className={`msg-row ${role}`}>
            <div className="msg-inner">
                <div className={`msg-avatar ${role}-avatar`}>
                    {role === 'user' ? (
                        <>
                            <img src="/user-avatar.png" alt="You" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                            <span style={{ display: 'none' }}>👤</span>
                        </>
                    ) : (
                        <>
                            <img src="/bot-avatar.png" alt="Bot" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                            <span style={{ display: 'none' }}>🔬</span>
                        </>
                    )}
                </div>
                <div className="msg-body">
                    <div className="msg-role">{role === 'user' ? 'You' : 'Assistant'}</div>
                    <div className="msg-text">
                        {role === 'assistant' ? <ReactMarkdown>{content}</ReactMarkdown> : <p>{content}</p>}
                    </div>

                    {role === 'assistant' && in_kb && sources?.length > 0 && (
                        <div className="citations-block">
                            <div className="citations-label">📚 Sources</div>
                            {sources.map((s, i) => (
                                <div key={i} className="citation-item">
                                    <span>{s.url ? '🌐' : '📄'}</span>
                                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : <span>{s.title}</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {role === 'assistant' && in_kb === false && (
                        <div className="not-in-kb-notice">⚠️ This information was not found in the loaded documents.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
