import React from 'react'
import { X, Sliders, Zap, Thermometer, Layers } from 'lucide-react'

export default function SettingsModal({ settings, setSettings, onClose }) {
    if (!settings) return null

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', width: '400px', padding: '1.5rem',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sliders size={20} className="text-accent" /> RAG Settings
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="setting-group" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Layers size={16} /> Retrieval Depth (Top K)
                        </label>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>{settings.top_k}</span>
                    </div>
                    <input
                        type="range" min="1" max="10" step="1"
                        value={settings.top_k}
                        onChange={(e) => handleChange('top_k', parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        Passages to retrieve per query. Higher = more context, slower.
                    </p>
                </div>

                {/* Hybrid Search Toggle - Can't really toggle "off" easily nicely without backend switch, assume boolean */}
                <div className="setting-group" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Zap size={16} /> Hybrid Search
                        </label>
                        <input
                            type="checkbox"
                            checked={settings.hybrid_search}
                            onChange={(e) => handleChange('hybrid_search', e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Combine Keyword (BM25) search with Vector search. Best for accuracy.
                    </p>
                </div>

                <div className="setting-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Thermometer size={16} /> Creativity (Temp)
                        </label>
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>{settings.temperature}</span>
                    </div>
                    <input
                        type="range" min="0" max="1.0" step="0.1"
                        value={settings.temperature}
                        onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        0.0 = Precise, 1.0 = Creative.
                    </p>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn-primary" style={{
                        background: 'var(--accent)', color: 'white', border: 'none',
                        padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
                    }}>
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
