import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, RefreshCw, Search, Bot } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import AgentCard from '../components/AgentCard';

/* ──────────────────────────────────────────────────────
   AgentsPage — Agent roster grid with live data
   ────────────────────────────────────────────────────── */

export default function AgentsPage() {
    const gateways = useGatewayStore(s => s.gateways);
    const agents = useMissionStore(s => s.agents);
    const sessions = useMissionStore(s => s.sessions);
    const cronJobs = useMissionStore(s => s.cronJobs);
    const setAgents = useMissionStore(s => s.setAgents);
    const setSessions = useMissionStore(s => s.setSessions);
    const setCronJobs = useMissionStore(s => s.setCronJobs);

    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);

    const connectedGw = Object.values(gateways).find(g => g.status === 'connected');

    const fetchAll = useCallback(async () => {
        if (!connectedGw) return;
        setLoading(true);
        try {
            const [agRes, seRes, crRes] = await Promise.all([
                connectedGw.connection.listAgents(),
                connectedGw.connection.listSessions(),
                connectedGw.connection.listCron({ includeDisabled: true }),
            ]);
            if (agRes?.agents) setAgents(agRes.agents);
            else if (Array.isArray(agRes)) setAgents(agRes);
            if (seRes?.sessions) setSessions(seRes.sessions);
            else if (Array.isArray(seRes)) setSessions(seRes);
            if (crRes?.jobs) setCronJobs(crRes.jobs);
            else if (Array.isArray(crRes)) setCronJobs(crRes);
        } catch (e) {
            console.error('Failed to fetch agent data:', e);
        } finally {
            setLoading(false);
        }
    }, [connectedGw]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-refresh every 15s
    useEffect(() => {
        const timer = setInterval(fetchAll, 15000);
        return () => clearInterval(timer);
    }, [fetchAll]);

    const filtered = agents.filter(a => {
        if (!search) return true;
        const s = search.toLowerCase();
        const name = (a.name || a.agentId || '').toLowerCase();
        const role = (a.role || '').toLowerCase();
        return name.includes(s) || role.includes(s);
    });

    return (
        <motion.div
            className="page agents-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="page-header">
                <div className="page-title">
                    <Users size={22} />
                    <h1>Agent Roster</h1>
                    <span className="badge">{agents.length}</span>
                </div>
                <div className="page-actions">
                    <div className="search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn-icon"
                        onClick={fetchAll}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {!connectedGw && (
                <div className="empty-state">
                    <Bot size={48} />
                    <h3>No Gateway Connected</h3>
                    <p>Connect to a Gateway from the Dashboard first.</p>
                </div>
            )}

            {connectedGw && agents.length === 0 && !loading && (
                <div className="empty-state">
                    <Users size={48} />
                    <h3>No Agents Found</h3>
                    <p>Create agents using the OpenClaw CLI or Gateway config.</p>
                </div>
            )}

            <div className="agents-grid">
                <AnimatePresence>
                    {filtered.map(agent => (
                        <AgentCard
                            key={agent.agentId || agent.id}
                            agent={agent}
                            sessions={sessions}
                            cronJobs={cronJobs}
                            onClick={setSelectedAgent}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Agent Detail Drawer */}
            <AnimatePresence>
                {selectedAgent && (
                    <AgentDetailDrawer
                        agent={selectedAgent}
                        sessions={sessions}
                        cronJobs={cronJobs}
                        gateway={connectedGw}
                        onClose={() => setSelectedAgent(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function AgentDetailDrawer({ agent, sessions, cronJobs, gateway, onClose }) {
    const agentId = agent.agentId || agent.id || '';
    const agentSessions = sessions.filter(s => s.key?.includes(agentId) || s.agentId === agentId);
    const agentCrons = cronJobs.filter(c => c.agentId === agentId || c.name?.toLowerCase().includes(agentId));
    const [soulContent, setSoulContent] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (gateway?.connection) {
            setLoading(true);
            gateway.connection.getAgentFile({ agentId, path: 'SOUL.md' })
                .then(r => { if (r?.content) setSoulContent(r.content); })
                .catch(() => { })
                .finally(() => setLoading(false));
        }
    }, [agentId, gateway]);

    return (
        <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="drawer agent-drawer"
                initial={{ x: 400 }}
                animate={{ x: 0 }}
                exit={{ x: 400 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="drawer-header">
                    <div className="drawer-title">
                        <span className="agent-avatar-lg">{agent.emoji || '🤖'}</span>
                        <div>
                            <h2>{agent.name || agentId}</h2>
                            <span className="agent-role">{agent.role || 'Agent'}</span>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}>&times;</button>
                </div>

                <div className="drawer-body">
                    {/* Sessions */}
                    <section className="drawer-section">
                        <h3>Sessions ({agentSessions.length})</h3>
                        {agentSessions.length === 0 && <p className="muted">No active sessions</p>}
                        {agentSessions.map(s => (
                            <div key={s.key || s.id} className="session-row">
                                <span className="session-key">{s.key}</span>
                                <span className={`status-dot ${s.active ? 'online' : 'offline'}`} />
                            </div>
                        ))}
                    </section>

                    {/* Cron Jobs */}
                    <section className="drawer-section">
                        <h3>Cron Jobs ({agentCrons.length})</h3>
                        {agentCrons.length === 0 && <p className="muted">No heartbeats configured</p>}
                        {agentCrons.map(c => (
                            <div key={c.id} className="cron-row">
                                <span className="cron-name">{c.name}</span>
                                <span className={`cron-status ${c.enabled ? 'enabled' : 'disabled'}`}>
                                    {c.enabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        ))}
                    </section>

                    {/* SOUL File */}
                    <section className="drawer-section">
                        <h3>SOUL.md</h3>
                        {loading && <p className="muted">Loading...</p>}
                        {!loading && soulContent && (
                            <pre className="soul-content">{soulContent}</pre>
                        )}
                        {!loading && !soulContent && (
                            <p className="muted">No SOUL file found for this agent.</p>
                        )}
                    </section>
                </div>
            </motion.div>
        </motion.div>
    );
}
