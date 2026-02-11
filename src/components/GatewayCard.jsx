import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Zap, Wifi, WifiOff, Trash2, RefreshCw, Pencil } from 'lucide-react';
import StatusBadge from './StatusBadge';
import useGatewayStore from '../stores/useGatewayStore';

export default function GatewayCard({ gateway, onClick, onEdit }) {
    const removeGateway = useGatewayStore(s => s.removeGateway);
    const removeGatewayWithData = useGatewayStore(s => s.removeGatewayWithData);
    const reconnectGateway = useGatewayStore(s => s.reconnectGateway);
    const [showConfirm, setShowConfirm] = useState(false);

    const health = gateway.health;
    const sessionCount = health?.sessions
        ? (typeof health.sessions === 'number' ? health.sessions : Object.keys(health.sessions).length)
        : 0;
    const channelCount = health?.channels
        ? (typeof health.channels === 'number' ? health.channels : Object.keys(health.channels).length)
        : 0;
    const nodeCount = gateway.nodes
        ? (Array.isArray(gateway.nodes) ? gateway.nodes.length : (gateway.nodes?.nodes?.length || 0))
        : 0;

    const version = health?.version || gateway.connection?.helloPayload?.version || '—';

    const channelNames = health?.channels
        ? (typeof health.channels === 'object' && !Array.isArray(health.channels)
            ? Object.entries(health.channels).map(([name, info]) => ({
                name,
                active: info?.connected || info?.active || info?.status === 'connected' || true,
            }))
            : [])
        : [];

    return (
        <motion.div
            className="card gateway-card"
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={() => onClick?.(gateway.id)}
        >
            <div className="gw-header">
                <div>
                    <div className="gw-name">
                        <Server size={16} style={{ color: 'var(--accent-cyan)' }} />
                        {gateway.name}
                    </div>
                    <div className="gw-url">{gateway.url}</div>
                </div>
                <div className="flex items-center gap-8">
                    <StatusBadge status={gateway.status} />
                    <button
                        className="btn-icon"
                        title="編輯"
                        onClick={e => { e.stopPropagation(); onEdit?.(gateway); }}
                        style={{ width: 28, height: 28 }}
                    >
                        <Pencil size={13} />
                    </button>
                    <button
                        className="btn-icon"
                        title="重新連接"
                        onClick={e => { e.stopPropagation(); reconnectGateway(gateway.id); }}
                        style={{ width: 28, height: 28 }}
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        className="btn-icon"
                        title="移除"
                        onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
                        style={{ width: 28, height: 28, color: 'var(--accent-red)' }}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Removal Confirmation */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        className="gw-confirm-overlay"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 8,
                            padding: '12px 16px',
                            marginTop: 12,
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '0.85rem', color: '#f87171', marginBottom: 10, fontWeight: 600 }}>
                            ⚠️ 確認移除 "{gateway.name}"？
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { removeGateway(gateway.id); setShowConfirm(false); }}
                                style={{ flex: 1, fontSize: '0.75rem' }}
                            >
                                只移除設定
                            </button>
                            <button
                                className="btn btn-sm"
                                onClick={() => { removeGatewayWithData(gateway.id); setShowConfirm(false); }}
                                style={{ flex: 1, fontSize: '0.75rem', background: 'var(--accent-red)', color: '#fff' }}
                            >
                                移除設定 + 全部數據
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowConfirm(false)}
                                style={{ fontSize: '0.75rem' }}
                            >
                                取消
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {gateway.status === 'connected' && (
                <>
                    <div className="gw-stats">
                        <div className="gw-stat">
                            <div className="gw-stat-value">{sessionCount}</div>
                            <div className="gw-stat-label">Sessions</div>
                        </div>
                        <div className="gw-stat">
                            <div className="gw-stat-value">{channelCount}</div>
                            <div className="gw-stat-label">Channels</div>
                        </div>
                        <div className="gw-stat">
                            <div className="gw-stat-value">{nodeCount}</div>
                            <div className="gw-stat-label">Nodes</div>
                        </div>
                    </div>

                    {channelNames.length > 0 && (
                        <div className="gw-channels">
                            {channelNames.map(ch => (
                                <span key={ch.name} className={`channel-tag ${ch.active ? 'active' : ''}`}>
                                    {ch.active ? <Wifi size={10} /> : <WifiOff size={10} />}
                                    {ch.name}
                                </span>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        v{version}
                    </div>
                </>
            )}

            {gateway.status === 'error' && (
                <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--accent-red)' }}>
                    連接失敗 — 請檢查地址同 token
                </div>
            )}

            {gateway.status === 'connecting' && (
                <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--accent-amber)' }}>
                    正在連接...
                </div>
            )}
        </motion.div>
    );
}
