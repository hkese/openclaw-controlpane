import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, User, MessageSquare, Cpu, Zap, Radio, Heart, Shield, Wifi, Filter } from 'lucide-react';

/* ── Event categorization ── */
function categorize(event) {
    const t = event.event;
    if (t === 'agent') return 'agent';
    if (t === 'presence') return 'status';
    if (t === 'shutdown') return 'system';
    if (t === 'tick') return 'heartbeat';
    if (t === 'health' || event.payload?.ok !== undefined) return 'health';
    return 'other';
}

const CATEGORY_CONFIG = {
    health: { icon: Heart, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)', label: 'Health' },
    agent: { icon: Cpu, color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', label: 'Agent' },
    status: { icon: Radio, color: 'var(--accent-cyan)', dim: 'var(--accent-cyan-dim)', label: 'Status' },
    system: { icon: Shield, color: 'var(--accent-red)', dim: 'var(--accent-red-dim)', label: 'System' },
    heartbeat: { icon: Activity, color: 'var(--text-muted)', dim: 'var(--bg-elevated)', label: 'Heartbeat' },
    other: { icon: MessageSquare, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)', label: 'Other' },
};

/* ── Human-readable event content ── */
function formatEvent(event) {
    const { event: type, payload, gatewayName } = event;

    // Health event — parse the JSON nicely
    if (type === 'health' || payload?.ok !== undefined) {
        const ok = payload?.ok;
        const duration = payload?.durationMs;
        const channels = payload?.channels;
        const channelNames = channels ? Object.keys(channels) : [];
        const authAge = payload?.authAgeMs;

        let detail = [];
        if (ok !== undefined) detail.push(ok ? '✅ Healthy' : '❌ Unhealthy');
        if (duration) detail.push(`${Math.round(duration)}ms`);
        if (channelNames.length) detail.push(`📡 ${channelNames.join(', ')}`);
        if (authAge) {
            const hrs = Math.floor(authAge / 3600000);
            const mins = Math.floor((authAge % 3600000) / 60000);
            detail.push(`🔑 auth: ${hrs}h ${mins}m`);
        }

        return {
            title: <><strong>{gatewayName}</strong> health</>,
            detail: detail.join('  ·  ') || null,
        };
    }

    if (type === 'agent') {
        const subType = payload?.type || payload?.event || '';
        const text = payload?.text || payload?.content || payload?.summary || '';
        if (subType === 'tool_use' || subType === 'tool') {
            return {
                title: <><strong>{gatewayName}</strong> 🔧 Tool use</>,
                detail: payload?.name || payload?.tool || text || null,
            };
        }
        if (subType === 'text' || subType === 'output') {
            return {
                title: <><strong>{gatewayName}</strong> 💬 Output</>,
                detail: text ? text.slice(0, 200) : null,
            };
        }
        return {
            title: <><strong>{gatewayName}</strong> Agent activity</>,
            detail: JSON.stringify(payload).slice(0, 150),
        };
    }

    if (type === 'presence') {
        return {
            title: <><strong>{gatewayName}</strong> 📡 Status update</>,
            detail: null,
        };
    }

    if (type === 'shutdown') {
        return {
            title: <><strong>{gatewayName}</strong> ⚠️ Shutting down</>,
            detail: payload?.reason || null,
        };
    }

    if (type === 'tick') {
        return {
            title: <><strong>{gatewayName}</strong> 💓 Heartbeat</>,
            detail: null,
        };
    }

    return {
        title: <><strong>{gatewayName}</strong> {type}</>,
        detail: payload ? JSON.stringify(payload).slice(0, 150) : null,
    };
}

function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}

export default function EventFeed({ events, maxItems = 50 }) {
    const [filter, setFilter] = useState('all');

    const filteredEvents = events
        .filter(e => e.event !== 'tick') // always hide heartbeat ticks
        .filter(e => filter === 'all' || categorize(e) === filter)
        .slice(0, maxItems);

    const categories = ['all', 'health', 'agent', 'status', 'system'];

    return (
        <div className="event-feed">
            {/* Category filter tabs */}
            <div style={{
                display: 'flex',
                gap: 4,
                marginBottom: 10,
                padding: '0 4px',
                flexWrap: 'wrap',
            }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 999,
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: filter === cat ? 'var(--accent-green-dim)' : 'transparent',
                            color: filter === cat ? 'var(--accent-green)' : 'var(--text-muted)',
                        }}
                    >
                        {cat === 'all' ? '全部' : CATEGORY_CONFIG[cat]?.label || cat}
                    </button>
                ))}
            </div>

            {filteredEvents.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No activity yet...
                </div>
            ) : (
                <AnimatePresence initial={false}>
                    {filteredEvents.map((event, idx) => {
                        const cat = categorize(event);
                        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
                        const Icon = cfg.icon;
                        const { title, detail } = formatEvent(event);
                        return (
                            <motion.div
                                key={`${event.timestamp}-${idx}`}
                                className="event-item"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div
                                    className="event-icon"
                                    style={{ background: cfg.dim }}
                                >
                                    <Icon size={14} style={{ color: cfg.color }} />
                                </div>
                                <div className="event-content">
                                    <div className="event-title">{title}</div>
                                    <div className="event-time">{timeAgo(event.ts || event.timestamp)}</div>
                                    {detail && (
                                        <div className="event-detail" style={{
                                            background: 'var(--bg-primary)',
                                            padding: '6px 8px',
                                            borderRadius: 6,
                                            marginTop: 4,
                                            fontSize: '0.72rem',
                                            fontFamily: 'var(--font-mono)',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.4,
                                        }}>
                                            {detail}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            )}
        </div>
    );
}
