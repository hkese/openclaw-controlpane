import { motion, AnimatePresence } from 'framer-motion';
import { Activity, User, MessageSquare, Cpu, Zap, Radio } from 'lucide-react';

function getEventIcon(event) {
    switch (event) {
        case 'agent': return <Cpu size={14} style={{ color: 'var(--accent-purple)' }} />;
        case 'presence': return <Radio size={14} style={{ color: 'var(--accent-green)' }} />;
        case 'tick': return <Activity size={14} style={{ color: 'var(--text-muted)' }} />;
        case 'shutdown': return <Zap size={14} style={{ color: 'var(--accent-red)' }} />;
        default: return <MessageSquare size={14} style={{ color: 'var(--accent-blue)' }} />;
    }
}

function getEventBgColor(event) {
    switch (event) {
        case 'agent': return 'var(--accent-purple-dim)';
        case 'presence': return 'var(--accent-green-dim)';
        case 'tick': return 'var(--bg-elevated)';
        case 'shutdown': return 'var(--accent-red-dim)';
        default: return 'var(--accent-blue-dim)';
    }
}

function formatEventContent(event) {
    const { event: eventType, payload, gatewayName } = event;

    if (eventType === 'agent') {
        const type = payload?.type || payload?.event || '';
        const text = payload?.text || payload?.content || payload?.summary || '';
        if (type === 'tool_use' || type === 'tool') {
            return {
                title: <><strong>{gatewayName}</strong> Agent 使用工具</>,
                detail: payload?.name || payload?.tool || text || null,
            };
        }
        if (type === 'text' || type === 'output') {
            return {
                title: <><strong>{gatewayName}</strong> Agent 輸出</>,
                detail: text ? text.slice(0, 200) : null,
            };
        }
        return {
            title: <><strong>{gatewayName}</strong> Agent 活動</>,
            detail: JSON.stringify(payload).slice(0, 150),
        };
    }

    if (eventType === 'presence') {
        return {
            title: <><strong>{gatewayName}</strong> 狀態更新</>,
            detail: null,
        };
    }

    if (eventType === 'shutdown') {
        return {
            title: <><strong>{gatewayName}</strong> Gateway 關閉中</>,
            detail: payload?.reason || null,
        };
    }

    if (eventType === 'tick') {
        return {
            title: <><strong>{gatewayName}</strong> 心跳</>,
            detail: null,
        };
    }

    return {
        title: <><strong>{gatewayName}</strong> {eventType}</>,
        detail: payload ? JSON.stringify(payload).slice(0, 150) : null,
    };
}

function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 5) return '剛剛';
    if (seconds < 60) return `${seconds}秒前`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}分鐘前`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}小時前`;
}

export default function EventFeed({ events, maxItems = 50 }) {
    const filteredEvents = events
        .filter(e => e.event !== 'tick') // hide ticks by default
        .slice(0, maxItems);

    return (
        <div className="event-feed">
            {filteredEvents.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    暫時冇活動...
                </div>
            ) : (
                <AnimatePresence initial={false}>
                    {filteredEvents.map((event, idx) => {
                        const { title, detail } = formatEventContent(event);
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
                                    style={{ background: getEventBgColor(event.event) }}
                                >
                                    {getEventIcon(event.event)}
                                </div>
                                <div className="event-content">
                                    <div className="event-title">{title}</div>
                                    <div className="event-time">{timeAgo(event.timestamp)}</div>
                                    {detail && <div className="event-detail">{detail}</div>}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            )}
        </div>
    );
}
