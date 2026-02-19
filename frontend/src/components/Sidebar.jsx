import React from 'react'
import { LayoutDashboard, MessageSquare, MessageSquarePlus, Trash2, Settings, PlusCircle, Database } from 'lucide-react'

export default function Sidebar({
    currentView, setCurrentView,
    threads, activeThread,
    onLoadThread, onDeleteThread, onNewChat,
    onToggleSources, onOpenSettings
}) {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo-wrap">
                    <img src="/logo.png" alt="Logo" className="logo-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    <div className="logo-fallback" style={{ display: 'none' }}>⚡</div>
                </div>
                <div className="brand-text">
                    <span className="brand">CiteFlow</span>
                    <span className="brand-sub">Research OS</span>
                </div>
            </div>

            <div className="nav-menu" style={{ padding: '0 0.7rem', marginBottom: '1rem' }}>
                <button
                    className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setCurrentView('dashboard')}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem', border: 'none', background: currentView === 'dashboard' ? 'var(--bg-elevated)' : 'transparent',
                        color: currentView === 'dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <LayoutDashboard size={18} /> Dashboard
                </button>
                <button
                    className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
                    onClick={() => setCurrentView('chat')}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem', border: 'none', background: currentView === 'chat' ? 'var(--bg-elevated)' : 'transparent',
                        color: currentView === 'chat' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        borderRadius: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
                        marginTop: '0.2rem', transition: 'all 0.2s'
                    }}
                >
                    <MessageSquare size={18} /> Chat
                </button>
            </div>

            <button className="new-chat-btn" onClick={onNewChat}>
                <MessageSquarePlus size={16} /> New Thread
            </button>

            <div className="thread-section-label">Recent Research</div>
            <div className="thread-list">
                {threads.map(t => (
                    <div key={t.id} className={`thread-item ${activeThread === t.id ? 'active' : ''}`} onClick={() => { setCurrentView('chat'); onLoadThread(t.id) }}>
                        <div className="thread-dot" />
                        <div className="thread-info">
                            <div className="thread-title">{t.title}</div>
                        </div>
                        <button className="thread-delete" onClick={e => { e.stopPropagation(); onDeleteThread(t.id, e) }}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
                {threads.length === 0 && <div className="empty-threads" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No threads yet</div>}
            </div>

            <div className="sidebar-footer">
                <button className="sidebar-footer-btn" onClick={onToggleSources}>
                    <Database size={16} /> Source Manager
                </button>
                <button className="sidebar-footer-btn" onClick={onOpenSettings}>
                    <Settings size={16} /> Settings
                </button>
                <div className="user-profile">
                    <img src="/user-avatar.png" alt="User" className="user-avatar-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    <div className="user-avatar-fallback" style={{ display: 'none' }}>👤</div>
                    <div className="user-info">
                        <div className="user-name">Sayyam Akram</div>
                        <div className="user-plan">Pro Plan</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
