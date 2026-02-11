import { useState } from 'react';
import { Server, LayoutDashboard, Users, MessageSquare, LayoutGrid, Clock, Newspaper, BookOpen, Check, Unplug, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import { useTasks } from '../hooks/useConvexMission';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, detail: 'Gateway overview' },
    { id: 'agents', label: 'Agents', icon: Users, detail: 'Agent roster' },
    { id: 'sessions', label: 'Sessions', icon: MessageSquare, detail: 'Chat & sessions' },
    { id: 'tasks', label: 'Task Board', icon: LayoutGrid, detail: 'Kanban board' },
    { id: 'journal', label: 'Journal', icon: BookOpen, detail: 'Dev diary' },
    { id: 'cron', label: 'Cron Jobs', icon: Clock, detail: 'Heartbeats & cron' },
    { id: 'standup', label: 'Standup', icon: Newspaper, detail: 'Daily summary' },
];

export default function Sidebar({ currentPage, onNavigate, onSelectGateway, onEditGateway }) {
    const gateways = useGatewayStore(s => s.gateways);
    const selectedGatewayId = useGatewayStore(s => s.selectedGatewayId);
    const selectGateway = useGatewayStore(s => s.selectGateway);
    const disconnectGateway = useGatewayStore(s => s.disconnectGateway);
    const reconnectGateway = useGatewayStore(s => s.reconnectGateway);
    const removeGateway = useGatewayStore(s => s.removeGateway);
    const removeGatewayWithData = useGatewayStore(s => s.removeGatewayWithData);
    const { tasks } = useTasks();
    const agents = useMissionStore(s => s.agents);
    const gwArray = Object.values(gateways);

    const [confirmId, setConfirmId] = useState(null);

    const inboxCount = tasks.filter(t => t.status === 'inbox').length;
    const reviewCount = tasks.filter(t => t.status === 'review').length;

    const handleGatewayClick = (gwId) => {
        selectGateway(gwId);
        onSelectGateway(gwId);
    };

    return (
        <aside className="app-sidebar">
            <div className="sidebar-section">
                <div className="sidebar-title">Mission Control</div>
                {NAV_ITEMS.map(item => {
                    const Icon = item.icon;
                    let badge = null;
                    if (item.id === 'agents' && agents.length > 0) badge = agents.length;
                    if (item.id === 'tasks' && (inboxCount + reviewCount) > 0) badge = inboxCount + reviewCount;

                    return (
                        <div
                            key={item.id}
                            className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => onNavigate(item.id)}
                        >
                            <div className="item-icon">
                                <Icon size={16} />
                            </div>
                            <div className="item-info">
                                <div className="item-name">{item.label}</div>
                                <div className="item-detail">{item.detail}</div>
                            </div>
                            {badge && <span className="sidebar-badge">{badge}</span>}
                        </div>
                    );
                })}
            </div>

            <div className="sidebar-section">
                <div className="sidebar-title">Gateways ({gwArray.length})</div>
                {gwArray.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No gateways added
                    </div>
                ) : (
                    gwArray.map(gw => {
                        const isSelected = gw.id === selectedGatewayId;
                        const isActive = currentPage === gw.id;
                        const isConnected = gw.status === 'connected';
                        const isConfirming = confirmId === gw.id;
                        return (
                            <div key={gw.id}>
                                <div
                                    className={`sidebar-item sidebar-gw-item ${isActive ? 'active' : ''} ${isSelected ? 'selected-gw' : ''}`}
                                    onClick={() => handleGatewayClick(gw.id)}
                                >
                                    <div className="item-icon">
                                        <Server size={16} />
                                    </div>
                                    <div className="item-info">
                                        <div className="item-name">
                                            {gw.name}
                                            {isSelected && <Check size={12} style={{ marginLeft: 4, color: 'var(--accent-cyan)' }} />}
                                        </div>
                                        <div className="item-detail">{gw.url}</div>
                                    </div>

                                    {/* Status dot — always visible */}
                                    <div
                                        className="item-status"
                                        style={{
                                            background: gw.status === 'connected' ? 'var(--accent-green)' :
                                                gw.status === 'connecting' ? 'var(--accent-amber)' : 'var(--accent-red)',
                                            boxShadow: gw.status === 'connected' ? '0 0 6px var(--accent-green)' : 'none',
                                        }}
                                    />

                                    {/* Action buttons — visible on hover */}
                                    <div className="gw-hover-actions">
                                        <button
                                            className="gw-action-btn"
                                            title="編輯"
                                            onClick={(e) => { e.stopPropagation(); onEditGateway?.(gw); }}
                                        >
                                            <Pencil size={11} />
                                        </button>

                                        {isConnected ? (
                                            <button
                                                className="gw-action-btn gw-disconnect"
                                                title="Disconnect"
                                                onClick={(e) => { e.stopPropagation(); disconnectGateway(gw.id); }}
                                            >
                                                <Unplug size={12} />
                                            </button>
                                        ) : (gw.status === 'disconnected' || gw.status === 'error') ? (
                                            <button
                                                className="gw-action-btn gw-reconnect"
                                                title="Reconnect"
                                                onClick={(e) => { e.stopPropagation(); reconnectGateway(gw.id); }}
                                            >
                                                <RefreshCw size={12} />
                                            </button>
                                        ) : null}

                                        <button
                                            className="gw-action-btn"
                                            title="移除"
                                            onClick={(e) => { e.stopPropagation(); setConfirmId(isConfirming ? null : gw.id); }}
                                            style={{ color: 'var(--accent-red)' }}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>

                                {/* Inline removal confirmation */}
                                <AnimatePresence>
                                    {isConfirming && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'rgba(239,68,68,0.08)',
                                                borderRadius: 6,
                                                margin: '4px 8px 8px 8px',
                                                fontSize: '0.72rem',
                                            }}
                                        >
                                            <div style={{ color: '#f87171', marginBottom: 6, fontWeight: 600 }}>
                                                確認移除？
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                                                    onClick={() => { removeGateway(gw.id); setConfirmId(null); }}
                                                >
                                                    只移除設定
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ fontSize: '0.68rem', padding: '2px 8px', background: 'var(--accent-red)', color: '#fff' }}
                                                    onClick={() => { removeGatewayWithData(gw.id); setConfirmId(null); }}
                                                >
                                                    設定+數據
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                                                    onClick={() => setConfirmId(null)}
                                                >
                                                    取消
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
