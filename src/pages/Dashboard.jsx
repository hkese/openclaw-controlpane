import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Server, Satellite } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import GatewayCard from '../components/GatewayCard';
import EventFeed from '../components/EventFeed';

export default function Dashboard({ onSelectGateway, onAddGateway }) {
    const gateways = useGatewayStore(s => s.gateways);
    const events = useGatewayStore(s => s.events);
    const gwArray = Object.values(gateways);

    if (gwArray.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🦞</div>
                <div className="empty-title">歡迎使用 OpenClaw ControlPane</div>
                <div className="empty-desc">
                    連接你嘅 OpenClaw Gateway 實例嚟開始監控同管理。
                    你可以添加任意數量嘅 Gateway，實時查看 sessions、channels 同 agent 活動。
                </div>
                <button className="btn btn-primary" onClick={onAddGateway}>
                    <Plus size={16} />
                    添加第一個 Gateway
                </button>
            </div>
        );
    }

    return (
        <div className="dashboard-grid">
            <div className="dashboard-left">
                <div>
                    <div className="section-title" style={{ marginBottom: 16 }}>
                        <Satellite size={12} style={{ display: 'inline', marginRight: 6 }} />
                        Gateway 實例 ({gwArray.length})
                    </div>
                    <div className="gateways-grid">
                        <AnimatePresence>
                            {gwArray.map(gw => (
                                <GatewayCard
                                    key={gw.id}
                                    gateway={gw}
                                    onClick={onSelectGateway}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="dashboard-right">
                <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="card-header">
                        <div className="card-title" style={{ fontSize: '0.85rem' }}>
                            ⚡ 實時活動
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {events.length} events
                        </div>
                    </div>
                    <EventFeed events={events} />
                </div>
            </div>
        </div>
    );
}
