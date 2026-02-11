import { useState, useEffect } from 'react';
import { Plus, Server, Activity, Zap, Radio } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';

export default function Header({ onAddGateway }) {
    const gateways = useGatewayStore(s => s.gateways);
    const sessions = useMissionStore(s => s.sessions);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const gwArray = Object.values(gateways);
    const connectedCount = gwArray.filter(g => g.status === 'connected').length;
    const totalCount = gwArray.length;

    // Use live session data from useMissionStore (accurate count)
    const totalSessions = sessions.length;

    // Channels from health data of connected gateways only
    let activeChannels = 0;
    gwArray.forEach(g => {
        if (g.status === 'connected' && g.health) {
            if (g.health.channels) {
                activeChannels += typeof g.health.channels === 'number'
                    ? g.health.channels
                    : Object.keys(g.health.channels).length;
            }
        }
    });

    return (
        <header className="app-header">
            <div className="header-left">
                <div className="header-logo">
                    <span className="logo-icon">🦞</span>
                    <span className="logo-text">ControlPane</span>
                </div>

                <div className="header-metrics">
                    <div className="metric-item">
                        <div className={`metric-dot ${connectedCount > 0 ? 'green' : 'red'}`} />
                        <div>
                            <div className="metric-label">Gateways</div>
                            <div className="metric-value">{connectedCount}/{totalCount}</div>
                        </div>
                    </div>
                    <div className="metric-item">
                        <div className="metric-dot blue" />
                        <div>
                            <div className="metric-label">Sessions</div>
                            <div className="metric-value">{totalSessions}</div>
                        </div>
                    </div>
                    <div className="metric-item">
                        <div className="metric-dot amber" />
                        <div>
                            <div className="metric-label">Channels</div>
                            <div className="metric-value">{activeChannels}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="header-right">
                <div className="header-time">
                    {time.toLocaleTimeString('zh-HK', { hour12: false })}
                </div>
                <button className="btn btn-primary btn-sm" onClick={onAddGateway}>
                    <Plus size={14} />
                    添加 Gateway
                </button>
            </div>
        </header>
    );
}
