import { Server, LayoutDashboard, Settings } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import StatusBadge from './StatusBadge';

export default function Sidebar({ currentPage, onNavigate, onSelectGateway }) {
    const gateways = useGatewayStore(s => s.gateways);
    const gwArray = Object.values(gateways);

    return (
        <aside className="app-sidebar">
            <div className="sidebar-section">
                <div className="sidebar-title">導航</div>
                <div
                    className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                >
                    <div className="item-icon">
                        <LayoutDashboard size={16} />
                    </div>
                    <div className="item-info">
                        <div className="item-name">Dashboard</div>
                        <div className="item-detail">所有 Gateway 概覽</div>
                    </div>
                </div>
            </div>

            <div className="sidebar-section">
                <div className="sidebar-title">Gateways ({gwArray.length})</div>
                {gwArray.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        未添加任何 Gateway
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
