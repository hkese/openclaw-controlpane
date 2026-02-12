import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, RefreshCw, Search, Trash2, RotateCcw, Send, Bot, Terminal } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';

/* ──────────────────────────────────────────────────────
   SessionsPage — List and interact with Gateway sessions
   ────────────────────────────────────────────────────── */

export default function SessionsPage() {
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const sessions = useMissionStore(s => s.sessions);
    const setSessions = useMissionStore(s => s.setSessions);

    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedSession, setSelectedSession] = useState(null);

    const connectedGw = getSelectedGateway();

    const fetchSessions = useCallback(async () => {
        if (!connectedGw) return;
        setLoading(true);
        try {
            const res = await connectedGw.connection.listSessions();
            if (res?.sessions) setSessions(res.sessions);
            else if (Array.isArray(res)) setSessions(res);
        } catch (e) {
            console.error('Failed to fetch sessions:', e);
        } finally {
            setLoading(false);
        }
    }, [connectedGw]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);
    useEffect(() => {
        const timer = setInterval(fetchSessions, 15000);
        return () => clearInterval(timer);
    }, [fetchSessions]);

    const filtered = sessions.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (s.key || '').toLowerCase().includes(q) ||
            (s.title || '').toLowerCase().includes(q) ||
            (s.label || '').toLowerCase().includes(q);
    });

    return (
        <motion.div className="page sessions-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header">
                <div className="page-title">
                    <MessageSquare size={22} />
                    <h1>Sessions</h1>
                    <span className="badge">{sessions.length}</span>
                </div>
                <div className="page-actions">
                    <div className="search-box">
                        <Search size={14} />
                        <input placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <button className="btn-icon" onClick={fetchSessions} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {!connectedGw && (
                <div className="empty-state">
                    <Bot size={48} /><h3>No Gateway Connected</h3>
                    <p>Connect to a Gateway from the Dashboard first.</p>
                </div>
            )}

            <div className="sessions-list">
                {filtered.map(session => (
                    <motion.div
                        key={session.key || session.id}
                        className={`session-item ${selectedSession?.key === session.key ? 'selected' : ''}`}
                        onClick={() => setSelectedSession(session)}
                        whileHover={{ x: 2 }}
                    >
                        <div className="session-item-left">
                            <span className={`status-dot ${session.active ? 'online' : 'offline'}`} />
                            <div>
                                <span className="session-key-text">{session.key}</span>
                                {session.title && <span className="session-title">{session.title}</span>}
                                {session.lastMessage && (
                                    <span className="session-preview">{session.lastMessage.slice(0, 100)}</span>
                                )}
                            </div>
                        </div>
                        <div className="session-item-right">
                            {session.label && <span className="session-label">{session.label}</span>}
                            {session.model && <span className="session-model">{session.model.split('/').pop()}</span>}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Chat Panel */}
            <AnimatePresence>
                {selectedSession && connectedGw && (
                    <ChatPanel
                        session={selectedSession}
                        gateway={connectedGw}
                        onClose={() => setSelectedSession(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function ChatPanel({ session, gateway, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!gateway?.connection) return;
        // Tail the chat log
        gateway.connection.tailChat({ sessionKey: session.key, limit: 50 })
            .then(res => {
                if (res?.messages) setMessages(res.messages);
                else if (Array.isArray(res)) setMessages(res);
            })
            .catch((err) => {
                console.warn('tailChat failed:', err);
            });
    }, [session.key, gateway]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        setSending(true);
        try {
            await gateway.connection.sendToAgent(input, { sessionKey: session.key });
            setMessages(prev => [...prev, { role: 'user', content: input, ts: Date.now() }]);
            setInput('');
            // Re-tail after a delay to get agent response
            setTimeout(async () => {
                const res = await gateway.connection.tailChat({ sessionKey: session.key, limit: 50 });
                if (res?.messages) setMessages(res.messages);
                else if (Array.isArray(res)) setMessages(res);
            }, 3000);
        } catch (e) {
            console.error('Failed to send:', e);
        } finally {
            setSending(false);
        }
    };

    return (
        <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="drawer chat-drawer"
                initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="drawer-header">
                    <div className="drawer-title">
                        <Terminal size={18} />
                        <div>
                            <h2>{session.key}</h2>
                            <span className="muted">{session.model || 'Unknown model'}</span>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}>&times;</button>
                </div>
                <div className="chat-messages">
                    {messages.length === 0 && <p className="muted center">No messages yet</p>}
                    {messages.map((msg, i) => {
                        // msg.content can be: string, { type, text }, or [{ type, text }]
                        let text = '';
                        const c = msg.content ?? msg.text;
                        if (typeof c === 'string') text = c;
                        else if (Array.isArray(c)) text = c.map(b => b.text || '').join('\n');
                        else if (c && typeof c === 'object') text = c.text || JSON.stringify(c);
                        else text = JSON.stringify(msg);
                        return (
                            <div key={i} className={`chat-msg ${msg.role || 'assistant'}`}>
                                <span className="chat-role">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                                <div className="chat-content">{text}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="chat-input-bar">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Send a message..."
                        disabled={sending}
                    />
                    <button className="btn-send" onClick={sendMessage} disabled={sending || !input.trim()}>
                        <Send size={16} />
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
