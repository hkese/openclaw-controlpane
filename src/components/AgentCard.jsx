import { motion } from 'framer-motion';
import { Bot, Clock, Zap, MessageSquare, MoreVertical } from 'lucide-react';

/* ──────────────────────────────────────────────────────
   AgentCard — Premium card for each agent in the roster
   Shows: emoji/avatar, name, role, status, model, sessions
   ────────────────────────────────────────────────────── */

const STATUS_COLORS = {
    idle: { bg: 'rgba(100,116,139,0.15)', dot: '#94a3b8', label: 'Idle' },
    active: { bg: 'rgba(34,197,94,0.12)', dot: '#22c55e', label: 'Active' },
    running: { bg: 'rgba(34,197,94,0.12)', dot: '#22c55e', label: 'Running' },
    blocked: { bg: 'rgba(239,68,68,0.12)', dot: '#ef4444', label: 'Blocked' },
    sleeping: { bg: 'rgba(168,85,247,0.12)', dot: '#a855f7', label: 'Sleeping' },
};

const AGENT_EMOJIS = {
    'main': '🤖',
    'product-analyst': '🔍',
    'customer-researcher': '🕵️',
    'seo-analyst': '👁️',
    'content-writer': '✍️',
    'social-media-manager': '🚀',
    'designer': '🎨',
    'email-marketing': '📧',
    'developer': '💻',
    'notion-agent': '📚',
};

export function getAgentEmoji(agentId) {
    if (!agentId) return '🤖';
    for (const [key, emoji] of Object.entries(AGENT_EMOJIS)) {
        if (agentId.includes(key)) return emoji;
    }
    return '🤖';
}

export function getAgentDisplayName(agent) {
    return agent?.name || agent?.displayName || agent?.agentId || 'Unknown';
}

export default function AgentCard({ agent, sessions = [], cronJobs = [], onClick }) {
    const agentId = agent?.agentId || agent?.id || '';
    const name = getAgentDisplayName(agent);
    const emoji = agent?.emoji || getAgentEmoji(agentId);
    const model = agent?.model || agent?.defaultModel || '—';

    // Determine status from sessions
    const agentSessions = sessions.filter(s => s.key?.includes(agentId) || s.agentId === agentId);
    const hasActive = agentSessions.some(s => s.active || s.running);
    const status = hasActive ? 'active' : 'idle';

    // Heartbeat from cron
    const heartbeatCrons = cronJobs.filter(c =>
        c.agentId === agentId || c.name?.toLowerCase().includes(agentId)
    );
    const lastHeartbeat = heartbeatCrons.length > 0
        ? heartbeatCrons.reduce((latest, c) => {
            const t = c.state?.lastRunAtMs || 0;
            return t > latest ? t : latest;
        }, 0)
        : null;

    const colors = STATUS_COLORS[status] || STATUS_COLORS.idle;

    return (
        <motion.div
            className="agent-card"
            onClick={() => onClick?.(agent)}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="agent-card-header">
                <div className="agent-avatar">{emoji}</div>
                <div className="agent-info">
                    <h3 className="agent-name">{name}</h3>
                    <span className="agent-role">{agent?.role || agentId}</span>
                </div>
                <div className="agent-status-dot" style={{ background: colors.dot }} title={colors.label} />
            </div>

            {/* Stats row */}
            <div className="agent-stats">
                <div className="agent-stat" title="Model">
                    <Zap size={13} />
                    <span>{typeof model === 'string' ? model.split('/').pop() : '—'}</span>
                </div>
                <div className="agent-stat" title="Sessions">
                    <MessageSquare size={13} />
                    <span>{agentSessions.length}</span>
                </div>
                <div className="agent-stat" title="Cron Jobs">
                    <Clock size={13} />
                    <span>{heartbeatCrons.length}</span>
                </div>
            </div>

            {/* Last heartbeat */}
            {lastHeartbeat ? (
                <div className="agent-heartbeat">
                    <Clock size={11} />
                    <span>Last beat: {formatRelative(lastHeartbeat)}</span>
                </div>
            ) : null}
        </motion.div>
    );
}

function formatRelative(ms) {
    const diff = Date.now() - ms;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ms).toLocaleDateString();
}
