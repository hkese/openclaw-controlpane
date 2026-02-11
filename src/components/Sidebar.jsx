import { Server, LayoutDashboard, Users, MessageSquare, LayoutGrid, Clock, Newspaper } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, detail: 'Gateway overview' },
    { id: 'agents', label: 'Agents', icon: Users, detail: 'Agent roster' },
    { id: 'sessions', label: 'Sessions', icon: MessageSquare, detail: 'Chat & sessions' },
    { id: 'tasks', label: 'Task Board', icon: LayoutGrid, detail: 'Kanban board' },
    { id: 'cron', label: 'Cron Jobs', icon: Clock, detail: 'Heartbeats & cron' },
    { id: 'standup', label: 'Standup', icon: Newspaper, detail: 'Daily summary' },
];

export default function Sidebar({ currentPage, onNavigate, onSelectGateway }) {
    const gateways = useGatewayStore(s => s.gateways);
    const tasks = useMissionStore(s => s.tasks);
    const agents = useMissionStore(s => s.agents);
    const gwArray = Object.values(gateways);

    const inboxCount = tasks.filter(t => t.status === 'inbox').length;
    const reviewCount = tasks.filter(t => t.status === 'review').length;

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
                    gwArray.map(gw => (
                        <div
                            key={gw.id}
                            className={`sidebar-item ${currentPage === gw.id ? 'active' : ''}`}
                            onClick={() => onSelectGateway(gw.id)}
                        >
                            <div className="item-icon">
                                <Server size={16} />
                            </div>
                            <div className="item-info">
                                <div className="item-name">{gw.name}</div>
                                <div className="item-detail">{gw.url}</div>
                            </div>
                            <div
                                className="item-status"
                                style={{
                                    background: gw.status === 'connected' ? 'var(--accent-green)' :
                                        gw.status === 'connecting' ? 'var(--accent-amber)' : 'var(--accent-red)',
                                    boxShadow: gw.status === 'connected' ? '0 0 6px var(--accent-green)' : 'none',
                                }}
                            />
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
