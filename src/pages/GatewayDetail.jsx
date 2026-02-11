import { motion } from 'framer-motion';
import { ArrowLeft, Server, Wifi, WifiOff, Cpu, Monitor, Smartphone, RefreshCw, Trash2 } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import StatusBadge from '../components/StatusBadge';
import EventFeed from '../components/EventFeed';

export default function GatewayDetail({ gatewayId, onBack }) {
    const gateways = useGatewayStore(s => s.gateways);
    const events = useGatewayStore(s => s.events);
    const removeGateway = useGatewayStore(s => s.removeGateway);
    const reconnectGateway = useGatewayStore(s => s.reconnectGateway);

    const gw = gateways[gatewayId];
    if (!gw) {
        return (
            <div className="empty-state">
                <div className="empty-title">Gateway 未搵到</div>
                <button className="btn btn-secondary" onClick={onBack}>返回 Dashboard</button>
            </div>
        );
    }

    const health = gw.health || {};
    const version = health.version || gw.connection?.helloPayload?.version || '—';
    const uptime = health.uptime ? formatUptime(health.uptime) : '—';

    const sessions = health.sessions
        ? (typeof health.sessions === 'object' && !Array.isArray(health.sessions)
            ? Object.entries(health.sessions)
            : [])
        : [];

    const channels = health.channels
        ? (typeof health.channels === 'object' && !Array.isArray(health.channels)
            ? Object.entries(health.channels)
            : [])
        : [];

    const nodes = gw.nodes
        ? (Array.isArray(gw.nodes) ? gw.nodes : (gw.nodes?.nodes || []))
        : [];

    const gwEvents = events.filter(e => e.gatewayName === gw.name);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="detail-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回 Dashboard
                </button>
                <div className="flex items-center gap-8">
                    <StatusBadge status={gw.status} />
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => reconnectGateway(gw.id)}
                    >
                        <RefreshCw size={13} />
                        重新連接
                    </button>
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={() => { removeGateway(gw.id); onBack(); }}
                    >
                        <Trash2 size={13} />
                        移除
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Server size={22} style={{ color: 'var(--accent-cyan)' }} />
                    {gw.name}
                </h1>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {gw.url}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-label">Version</div>
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>{version}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Uptime</div>
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>{uptime}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Sessions</div>
                    <div className="stat-value">{sessions.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Nodes</div>
                    <div className="stat-value">{nodes.length}</div>
                </div>
            </div>

            {/* Channels */}
            {channels.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="section-title" style={{ marginBottom: 12 }}>
                        <Wifi size={12} style={{ display: 'inline', marginRight: 6 }} />
                        Channels ({channels.length})
                    </div>
                    <table className="list-table">
                        <thead>
                            <tr>
                                <th>Channel</th>
                                <th>狀態</th>
                                <th>詳情</th>
                            </tr>
                        </thead>
                        <tbody>
                            {channels.map(([name, info]) => {
                                const isOnline = info?.linked || info?.running || info?.connected || info?.active || info?.probe?.ok || info?.status === 'connected' || info?.status === 'online';
                                const isConfigured = info?.configured;
                                const statusLabel = isOnline ? 'connected' : (isConfigured ? 'configured' : 'disconnected');
                                return (
                                    <tr key={name}>
                                        <td style={{ fontWeight: 600 }}>{name}</td>
                                        <td>
                                            <StatusBadge status={statusLabel} />
                                        </td>
                                        <td className="mono" style={{ color: 'var(--text-muted)' }}>
                                            {info && typeof info === 'object'
                                                ? channelSummary(name, info)
                                                : String(info)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Sessions */}
            {sessions.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="section-title" style={{ marginBottom: 12 }}>
                        <Cpu size={12} style={{ display: 'inline', marginRight: 6 }} />
                        Sessions ({sessions.length})
                    </div>
                    <table className="list-table">
                        <thead>
                            <tr>
                                <th>Session ID</th>
                                <th>Model</th>
                                <th>狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(([id, info]) => (
                                <tr key={id}>
                                    <td className="mono">{id}</td>
                                    <td className="mono">{info?.model || info?.modelId || '—'}</td>
                                    <td>
                                        <StatusBadge status={info?.active || info?.busy ? 'working' : 'connected'} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Nodes */}
            {nodes.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="section-title" style={{ marginBottom: 12 }}>
                        <Monitor size={12} style={{ display: 'inline', marginRight: 6 }} />
                        Nodes ({nodes.length})
                    </div>
                    <table className="list-table">
                        <thead>
                            <tr>
                                <th>Node</th>
                                <th>平台</th>
                                <th>狀態</th>
                                <th>功能</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodes.map((node, i) => (
                                <tr key={node.id || i}>
                                    <td style={{ fontWeight: 600 }}>{node.displayName || node.id || `Node ${i + 1}`}</td>
                                    <td className="mono">{node.platform || node.deviceFamily || '—'}</td>
                                    <td>
                                        <StatusBadge status={node.connected || node.paired ? 'connected' : 'disconnected'} />
                                    </td>
                                    <td className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {node.commands ? (Array.isArray(node.commands) ? node.commands.join(', ') : Object.keys(node.commands).join(', ')).slice(0, 60) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Event Feed */}
            <div className="card" style={{ maxHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="section-title" style={{ marginBottom: 12 }}>
                    ⚡ 呢個 Gateway 嘅活動
                </div>
                <EventFeed events={gwEvents} maxItems={30} />
            </div>
        </motion.div>
    );
}

function formatUptime(seconds) {
    if (typeof seconds !== 'number') return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}日 ${h}時 ${m}分`;
    if (h > 0) return `${h}時 ${m}分`;
    return `${m}分`;
}

function channelSummary(name, info) {
    const parts = [];
    if (info.linked !== undefined) parts.push(`linked: ${info.linked}`);
    if (info.running !== undefined) parts.push(`running: ${info.running}`);
    if (info.configured !== undefined) parts.push(`configured: ${info.configured}`);
    if (info.self) {
        // WhatsApp self info
        const phone = info.self?.e164 || info.self?.phoneNumber;
        if (phone) parts.push(`📞 ${phone}`);
    }
    if (info.probe?.ok !== undefined) parts.push(`probe: ${info.probe.ok ? '✅' : '❌'}`);
    if (info.probe?.bot?.username) parts.push(`🤖 ${info.probe.bot.username}`);
    if (info.tokenSource && info.tokenSource !== 'none') parts.push(`token: ${info.tokenSource}`);
    if (info.authAgeMs) {
        const hrs = Math.floor(info.authAgeMs / 3600000);
        parts.push(`auth: ${hrs}h`);
    }
    if (parts.length === 0) {
        return Object.entries(info).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ').slice(0, 80) || '—';
    }
    return parts.join(' · ');
}
