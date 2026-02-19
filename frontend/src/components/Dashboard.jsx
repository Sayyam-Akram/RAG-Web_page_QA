import React from 'react'
import { FileText, Link2, TrendingUp, BarChart3, Database, Clock, ArrowRight, MessageSquare, CheckCircle2 } from 'lucide-react'

export default function Dashboard({
    status, threads,
    activeSources, setActiveSources,
    setSourceMode, setCurrentView, loadThread
}) {

    // Calculate stats
    const totalSources = status.sources?.length || 0
    const activeCount = activeSources.length
    const totalThreads = threads.length
    const totalMessages = threads.reduce((acc, t) => acc + (t.message_count || 0), 0)

    return (
        <div className="dashboard-container" style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>

            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>Research Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back, Dr. Sayyam. Here is the latest synthesis from your lab.</p>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ padding: '8px', background: 'var(--accent-glow)', borderRadius: '8px', color: 'var(--accent)' }}>
                            <Database size={20} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)', background: 'var(--accent-green-glow)', padding: '2px 8px', borderRadius: '12px' }}>
                            <CheckCircle2 size={12} /> Synced
                        </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{totalSources}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Indexed Sources</div>
                </div>

                <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ padding: '8px', background: 'var(--accent-teal-glow)', borderRadius: '8px', color: 'var(--accent-teal)' }}>
                            <MessageSquare size={20} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: '12px' }}>Active</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{totalThreads}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Research Threads</div>
                </div>

                <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ padding: '8px', background: 'rgba(251, 113, 133, 0.1)', borderRadius: '8px', color: 'var(--accent-rose)' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{totalMessages}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Insights Generated</div>
                </div>
            </div>

            {/* Split View */}
            <div className="dashboard-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>

                {/* Left: Source Explorer */}
                <div className="section-col">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'var(--font-serif)' }}>Source Explorer</h3>
                        <button style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSourceMode('url')}>View All</button>
                    </div>

                    <div className="card-panel" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {status.sources && status.sources.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE</th>
                                        <th style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TYPE</th>
                                        <th style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                                        <th style={{ padding: '0.8rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {status.sources.map((s, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {s.type === 'url' ? <Link2 size={14} color="var(--accent)" /> : <FileText size={14} color="var(--accent-teal)" />}
                                                {s.title}
                                            </td>
                                            <td style={{ padding: '0.8rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{s.type}</td>
                                            <td style={{ padding: '0.8rem 1rem' }}>
                                                <span style={{ fontSize: '0.7rem', background: 'var(--accent-green-glow)', color: 'var(--accent-green)', padding: '2px 6px', borderRadius: '4px' }}>Indexed</span>
                                            </td>
                                            <td style={{ padding: '0.8rem 1rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={activeSources.includes(s.title)}
                                                    onChange={e => {
                                                        if (e.target.checked) setActiveSources(p => [...p, s.title])
                                                        else setActiveSources(p => p.filter(t => t !== s.title))
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No sources indexed. Upload documents or add URLs to get started.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Recent Threads */}
                <div className="section-col">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600, fontFamily: 'var(--font-serif)', marginBottom: '1rem' }}>Recent Insights</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {threads.slice(0, 3).map(t => (
                            <div key={t.id}
                                style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'transform 0.2s' }}
                                onClick={() => { setCurrentView('chat'); loadThread(t.id); }}
                            >
                                <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Clock size={12} /> {new Date(t.created).toLocaleDateString()}
                                </div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem', lineHeight: '1.4' }}>
                                    {t.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    View Thread <ArrowRight size={12} />
                                </div>
                            </div>
                        ))}
                        {threads.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No recent activity.</div>}
                    </div>
                </div>

            </div>
        </div>
    )
}
