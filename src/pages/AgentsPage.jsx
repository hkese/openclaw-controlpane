import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, RefreshCw, Search, Bot, Rocket, Trash2, X, Check, CheckCheck, Loader } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import { useTasks } from '../hooks/useConvexMission';
import AgentCard from '../components/AgentCard';
import AGENT_TEMPLATES from '../lib/agentTemplates';

/* ──────────────────────────────────────────────────────
   AgentsPage — Agent roster grid with live data
   v2.1: Provisioning + live activity status
   ────────────────────────────────────────────────────── */

export default function AgentsPage() {
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const agents = useMissionStore(s => s.agents);
    const sessions = useMissionStore(s => s.sessions);
    const cronJobs = useMissionStore(s => s.cronJobs);
    const setAgents = useMissionStore(s => s.setAgents);
    const setSessions = useMissionStore(s => s.setSessions);
    const setCronJobs = useMissionStore(s => s.setCronJobs);

    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [showProvision, setShowProvision] = useState(false);
    const [agentActivities, setAgentActivities] = useState({});

    const connectedGw = getSelectedGateway();

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

    // Fetch last activity for each agent from sessions
    const fetchActivities = useCallback(async () => {
        if (!connectedGw || agents.length === 0) return;
        const activities = {};
        for (const agent of agents) {
            const agentId = agent.agentId || agent.id || '';
            const agentSessions = sessions.filter(
                s => s.key?.includes(agentId) || s.agentId === agentId
            );
            if (agentSessions.length > 0) {
                const activeSession = agentSessions.find(s => s.active || s.running);
                if (activeSession) {
                    try {
                        const tail = await connectedGw.connection.tailChat({
                            sessionKey: activeSession.key,
                            limit: 1,
                        });
                        const lastMsg = tail?.messages?.[0] || tail?.[0];
                        if (lastMsg) {
                            const content = lastMsg.content || lastMsg.text || '';
                            activities[agentId] = {
                                status: 'active',
                                sessionKey: activeSession.key,
                                lastMessage: typeof content === 'string'
                                    ? content.slice(0, 100)
                                    : JSON.stringify(content).slice(0, 100),
                                model: activeSession.model || activeSession.modelId || null,
                            };
                        } else {
                            activities[agentId] = { status: 'active', sessionKey: activeSession.key };
                        }
                    } catch {
                        activities[agentId] = { status: 'active', sessionKey: activeSession.key };
                    }
                } else {
                    // Has sessions but none active
                    activities[agentId] = {
                        status: 'idle',
                        sessionCount: agentSessions.length,
                    };
                }
            }
        }
        setAgentActivities(activities);
    }, [connectedGw, agents, sessions]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { fetchActivities(); }, [fetchActivities]);

    // Auto-refresh every 15s
    useEffect(() => {
        const timer = setInterval(() => {
            fetchAll();
            fetchActivities();
        }, 15000);
        return () => clearInterval(timer);
    }, [fetchAll, fetchActivities]);

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
                    {connectedGw && (
                        <button
                            className="btn-primary"
                            onClick={() => setShowProvision(true)}
                            title="Provision agents from templates"
                        >
                            <Rocket size={14} /> Provision Team
                        </button>
                    )}
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
                    <p>Provision a team using the button above, or create agents via the CLI.</p>
                    <button className="btn-primary" onClick={() => setShowProvision(true)} style={{ marginTop: 16 }}>
                        <Rocket size={14} /> Provision Team
                    </button>
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
                            activity={agentActivities[agent.agentId || agent.id]}
                            onClick={setSelectedAgent}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Provision Modal */}
            <AnimatePresence>
                {showProvision && (
                    <ProvisionModal
                        gateway={connectedGw}
                        existingAgents={agents}
                        onClose={() => setShowProvision(false)}
                        onDone={() => { setShowProvision(false); fetchAll(); }}
                    />
                )}
            </AnimatePresence>

            {/* Agent Detail Drawer */}
            <AnimatePresence>
                {selectedAgent && (
                    <AgentDetailDrawer
                        agent={selectedAgent}
                        sessions={sessions}
                        cronJobs={cronJobs}
                        gateway={connectedGw}
                        activity={agentActivities[selectedAgent.agentId || selectedAgent.id]}
                        onClose={() => setSelectedAgent(null)}
                        onRefresh={fetchAll}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   Provision Modal
   ══════════════════════════════════════════════ */

function ProvisionModal({ gateway, existingAgents, onClose, onDone }) {
    const existingIds = useMemo(
        () => new Set(existingAgents.map(a => a.agentId || a.id)),
        [existingAgents]
    );

    const [selected, setSelected] = useState(() =>
        AGENT_TEMPLATES.filter(t => !existingIds.has(t.id)).map(t => t.id)
    );
    const [provisioning, setProvisioning] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' });
    const [results, setResults] = useState([]);
    const [removing, setRemoving] = useState(false);

    const availableTemplates = AGENT_TEMPLATES.filter(t => !existingIds.has(t.id));
    const allSelected = availableTemplates.length > 0 && selected.length === availableTemplates.length;

    const toggleAll = () => {
        if (allSelected) {
            setSelected([]);
        } else {
            setSelected(availableTemplates.map(t => t.id));
        }
    };

    const toggle = (id) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleProvision = async () => {
        const templates = AGENT_TEMPLATES.filter(t => selected.includes(t.id));
        if (templates.length === 0) return;

        setProvisioning(true);
        setProgress({ current: 0, total: templates.length, currentName: '' });
        const res = [];

        for (let i = 0; i < templates.length; i++) {
            const t = templates[i];
            setProgress({ current: i + 1, total: templates.length, currentName: t.name });
            try {
                await gateway.connection.createAgent({
                    agentId: t.id,
                    name: t.name,
                    emoji: t.emoji,
                    role: t.role,
                    defaultModel: t.defaultModel,
                });
                // Upload SOUL.md
                try {
                    await gateway.connection.setAgentFile({
                        agentId: t.id,
                        path: 'SOUL.md',
                        content: t.soul,
                    });
                } catch { /* SOUL upload optional */ }
                res.push({ id: t.id, name: t.name, ok: true });
            } catch (e) {
                res.push({ id: t.id, name: t.name, ok: false, error: e.message });
            }
        }

        setResults(res);
        setProvisioning(false);
    };

    const handleRemoveAll = async () => {
        if (!window.confirm('Remove ALL agents? This cannot be undone.')) return;
        setRemoving(true);
        for (const agent of existingAgents) {
            try {
                await gateway.connection.deleteAgent({ agentId: agent.agentId || agent.id });
            } catch { /* continue */ }
        }
        setRemoving(false);
        onDone();
    };

    const hasResults = results.length > 0;
    const successCount = results.filter(r => r.ok).length;

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="modal provision-modal"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2><Rocket size={18} /> Provision Team</h2>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>

                {!hasResults ? (
                    <>
                        <div className="provision-subheader">
                            <p className="muted">
                                Select agents to provision with SOUL templates.
                                Already-provisioned agents are greyed out.
                            </p>
                            <button className="btn-text" onClick={toggleAll}>
                                {allSelected ? <><CheckCheck size={14} /> Deselect All</> : <><Check size={14} /> Select All</>}
                            </button>
                        </div>

                        <div className="provision-grid">
                            {AGENT_TEMPLATES.map(t => {
                                const exists = existingIds.has(t.id);
                                const isSelected = selected.includes(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        className={`provision-card ${exists ? 'exists' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => !exists && toggle(t.id)}
                                    >
                                        <div className="provision-card-check">
                                            {exists ? (
                                                <span className="provision-exists-badge">Active</span>
                                            ) : (
                                                <span className={`provision-checkbox ${isSelected ? 'checked' : ''}`}>
                                                    {isSelected && <Check size={12} />}
                                                </span>
                                            )}
                                        </div>
                                        <span className="provision-emoji">{t.emoji}</span>
                                        <h4>{t.name}</h4>
                                        <span className="provision-role">{t.role}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress Bar */}
                        {provisioning && (
                            <div className="provision-progress">
                                <div className="provision-progress-bar">
                                    <div
                                        className="provision-progress-fill"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    />
                                </div>
                                <span className="provision-progress-text">
                                    <Loader size={12} className="spin" />
                                    Provisioning {progress.currentName}... ({progress.current}/{progress.total})
                                </span>
                            </div>
                        )}

                        <div className="modal-actions">
                            <div className="modal-actions-left">
                                {existingAgents.length > 0 && (
                                    <button
                                        className="btn-danger-outline"
                                        onClick={handleRemoveAll}
                                        disabled={provisioning || removing}
                                    >
                                        {removing ? <><Loader size={12} className="spin" /> Removing...</> : <><Trash2 size={14} /> Remove All</>}
                                    </button>
                                )}
                            </div>
                            <div className="modal-actions-right">
                                <button className="btn-secondary" onClick={onClose} disabled={provisioning}>Cancel</button>
                                <button
                                    className="btn-primary"
                                    onClick={handleProvision}
                                    disabled={provisioning || selected.length === 0}
                                >
                                    {provisioning
                                        ? <><Loader size={14} className="spin" /> Provisioning...</>
                                        : <><Rocket size={14} /> Provision {selected.length} Agent{selected.length !== 1 ? 's' : ''}</>
                                    }
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ─── Results ─── */
                    <>
                        <div className="provision-results">
                            <div className="provision-results-summary">
                                <span className="provision-results-icon">{successCount === results.length ? '🎉' : '⚠️'}</span>
                                <h3>{successCount}/{results.length} agents provisioned</h3>
                            </div>
                            <div className="provision-results-list">
                                {results.map(r => (
                                    <div key={r.id} className={`provision-result ${r.ok ? 'success' : 'error'}`}>
                                        <span>{r.ok ? '✅' : '❌'}</span>
                                        <span>{r.name}</span>
                                        {r.error && <span className="provision-result-error">{r.error}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-actions">
                            <div className="modal-actions-left" />
                            <div className="modal-actions-right">
                                <button className="btn-primary" onClick={onDone}>Done</button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   Agent Detail Drawer
   ══════════════════════════════════════════════ */

function AgentDetailDrawer({ agent, sessions, cronJobs, gateway, activity, onClose, onRefresh }) {
    const agentId = agent.agentId || agent.id || '';
    const agentSessions = sessions.filter(s => s.key?.includes(agentId) || s.agentId === agentId);
    const agentCrons = cronJobs.filter(c => c.agentId === agentId || c.name?.toLowerCase().includes(agentId));
    const { tasks } = useTasks();
    const assignedTasks = useMemo(
        () => tasks.filter(t => t.assigneeIds?.includes(agentId)),
        [tasks, agentId]
    );

    const [activeTab, setActiveTab] = useState('overview');
    const [soulContent, setSoulContent] = useState(null);
    const [soulEditing, setSoulEditing] = useState(false);
    const [soulDraft, setSoulDraft] = useState('');
    const [agentFiles, setAgentFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [workspacePath, setWorkspacePath] = useState('');
    const [availableModels, setAvailableModels] = useState([]);
    const [soulError, setSoulError] = useState('');

    // Editable fields
    const [editName, setEditName] = useState(agent.name || '');
    const [editEmoji, setEditEmoji] = useState(agent.emoji || '🤖');
    const [editRole, setEditRole] = useState(agent.role || '');
    const [editModel, setEditModel] = useState(agent.defaultModel || agent.model || '');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const EMOJI_OPTIONS = ['🤖', '🔍', '🕵️', '👁️', '✍️', '🚀', '🎨', '📧', '💻', '📚', '🧠', '⚡', '🎯', '🛡️', '🔔', '📊', '🌐', '🎭', '🦊', '🐙', '🦅', '🐺', '🦁', '🐉', '💎', '🔮', '⭐', '🌙', '☀️', '🔥', '🧪'];

    const ROLE_OPTIONS = [
        'Blog & copy', 'User research', 'Visual design', 'Code & infra',
        'Email campaigns', 'Docs & knowledge base', 'Market analysis',
        'SEO optimization', 'Social content', 'QA / Testing',
        'DevOps', 'Product management', 'Team lead', 'Custom',
    ];

    // Fallback model list
    const FALLBACK_MODELS = [
        'claude-opus-4-6-thinking', 'claude-sonnet-4-5-thinking',
        'gemini-3-flash', 'gemini-3-pro-high',
    ];

    useEffect(() => {
        if (gateway?.connection) {
            setLoading(true);
            setSoulError('');
            Promise.all([
                gateway.connection.getAgentFile({ agentId, path: 'SOUL.md' })
                    .catch(() => gateway.connection.getAgentFile({ agentId, path: './SOUL.md' }).catch(() => null)),
                gateway.connection.getAgentFiles?.({ agentId }).catch(() => null),
                gateway.connection.getConfig?.().catch(() => null),
                gateway.connection.listModels?.().catch(() => null),
            ]).then(([soulRes, filesRes, configRes, modelsRes]) => {
                if (soulRes?.content) {
                    setSoulContent(soulRes.content);
                    setSoulDraft(soulRes.content);
                } else {
                    setSoulError('SOUL.md not found — the gateway may not have agent file access configured, or the workspace path may be incorrect.');
                }
                if (filesRes?.files) setAgentFiles(filesRes.files);
                else if (Array.isArray(filesRes)) setAgentFiles(filesRes);
                // Extract workspace path from config
                if (configRes) {
                    const agentConf = configRes?.agents?.list?.find(a => a.id === agentId);
                    setWorkspacePath(agentConf?.workspace || configRes?.agents?.defaults?.workspace || '');
                }
                // Extract available models
                if (modelsRes?.models) {
                    setAvailableModels(modelsRes.models.map(m => m.id || m.name || m));
                } else if (Array.isArray(modelsRes)) {
                    setAvailableModels(modelsRes.map(m => m.id || m.name || m));
                } else if (configRes?.agents?.defaults?.models) {
                    setAvailableModels(Object.keys(configRes.agents.defaults.models));
                }
            }).finally(() => setLoading(false));
        }
    }, [agentId, gateway]);

    const handleSaveOverview = async () => {
        if (!gateway?.connection) return;
        setSaving(true);
        try {
            await gateway.connection.updateAgent({
                agentId,
                name: editName,
                emoji: editEmoji,
                role: editRole,
                defaultModel: editModel,
            });
            // Refresh agent list so card updates immediately
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error('Failed to update agent:', e);
        }
        setSaving(false);
    };

    const handleSaveSoul = async () => {
        if (!gateway?.connection) return;
        setSaving(true);
        try {
            await gateway.connection.setAgentFile({ agentId, path: 'SOUL.md', content: soulDraft });
            setSoulContent(soulDraft);
            setSoulEditing(false);
        } catch (e) {
            console.error('Failed to save SOUL.md:', e);
        }
        setSaving(false);
    };

    // Infer channels from sessions
    const inferredChannels = useMemo(() => {
        const channels = new Set();
        agentSessions.forEach(s => {
            const key = s.key || '';
            if (key.includes('whatsapp')) channels.add('WhatsApp');
            if (key.includes('discord')) channels.add('Discord');
            if (key.includes('slack')) channels.add('Slack');
            if (key.includes('telegram')) channels.add('Telegram');
        });
        return [...channels];
    }, [agentSessions]);

    const TABS = [
        { id: 'overview', label: 'Overview' },
        { id: 'files', label: 'Files' },
        { id: 'tools', label: 'Tools' },
        { id: 'skills', label: 'Skills' },
        { id: 'channels', label: 'Channels' },
        { id: 'cron', label: 'Cron Jobs' },
    ];

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
                initial={{ x: 500 }}
                animate={{ x: 0 }}
                exit={{ x: 500 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={e => e.stopPropagation()}
                style={{ width: 580 }}
            >
                {/* Header */}
                <div className="drawer-header">
                    <div className="drawer-title">
                        <span className="agent-avatar-lg">{editEmoji}</span>
                        <div>
                            <h2>{editName || agentId}</h2>
                            <span className="agent-role">{editRole || 'Agent'}</span>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}>&times;</button>
                </div>

                {/* Tab bar */}
                <div className="agent-tab-bar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`agent-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="drawer-body">
                    {/* ═══ OVERVIEW TAB ═══ */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Current Activity */}
                            <section className="drawer-section">
                                <h3>Current Activity</h3>
                                {activity?.status === 'active' ? (
                                    <div className="agent-activity-block active">
                                        <span className="activity-dot pulse" />
                                        <div>
                                            <strong>Working</strong>
                                            {activity.sessionKey && (
                                                <span className="activity-session">Session: {activity.sessionKey}</span>
                                            )}
                                            {activity.lastMessage && (
                                                <p className="activity-message">"{activity.lastMessage}"</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="agent-activity-block idle">
                                        <span className="activity-dot" />
                                        <span>Idle — no active session</span>
                                    </div>
                                )}
                            </section>

                            {/* Editable Fields */}
                            <section className="drawer-section">
                                <h3>Agent Settings</h3>
                                <div className="agent-edit-grid">
                                    <div className="agent-edit-field">
                                        <label>Emoji / Icon</label>
                                        <div className="emoji-picker-wrap">
                                            <button
                                                className="emoji-picker-btn"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            >
                                                <span className="emoji-preview">{editEmoji}</span>
                                                <span className="emoji-change-label">Change</span>
                                            </button>
                                            {showEmojiPicker && (
                                                <div className="emoji-picker-dropdown">
                                                    {EMOJI_OPTIONS.map(e => (
                                                        <button
                                                            key={e}
                                                            className={`emoji-option ${editEmoji === e ? 'selected' : ''}`}
                                                            onClick={() => { setEditEmoji(e); setShowEmojiPicker(false); }}
                                                        >
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="agent-edit-field">
                                        <label>Name</label>
                                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Agent name" />
                                    </div>
                                    <div className="agent-edit-field">
                                        <label>Role</label>
                                        <select
                                            className="glass-select"
                                            value={ROLE_OPTIONS.includes(editRole) ? editRole : 'Custom'}
                                            onChange={e => {
                                                if (e.target.value === 'Custom') setEditRole('');
                                                else setEditRole(e.target.value);
                                            }}
                                        >
                                            {ROLE_OPTIONS.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                        {(!ROLE_OPTIONS.includes(editRole) || editRole === '') && (
                                            <input
                                                value={editRole}
                                                onChange={e => setEditRole(e.target.value)}
                                                placeholder="Enter custom role..."
                                                style={{ marginTop: 6 }}
                                            />
                                        )}
                                    </div>
                                    <div className="agent-edit-field">
                                        <label>Model</label>
                                        <select
                                            className="glass-select"
                                            value={editModel}
                                            onChange={e => setEditModel(e.target.value)}
                                        >
                                            <option value="">— Select model —</option>
                                            {(availableModels.length > 0 ? availableModels : FALLBACK_MODELS).map(m => (
                                                <option key={m} value={m}>{m.replace('google-antigravity/', '')}</option>
                                            ))}
                                            {editModel && ![...availableModels, ...FALLBACK_MODELS].includes(editModel) && (
                                                <option value={editModel}>{editModel} (current)</option>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={handleSaveOverview}
                                    disabled={saving}
                                    style={{ marginTop: 12, width: '100%' }}
                                >
                                    {saving ? <><Loader size={14} className="spin" /> Saving...</> : <><Check size={14} /> Save Changes</>}
                                </button>
                            </section>

                            {/* Workspace Path */}
                            {workspacePath && (
                                <section className="drawer-section">
                                    <h3>Workspace</h3>
                                    <div className="workspace-path-row">
                                        <code className="workspace-path">{workspacePath}</code>
                                        <button
                                            className="btn-icon"
                                            title="Copy path"
                                            onClick={() => navigator.clipboard.writeText(workspacePath)}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </section>
                            )}

                            {/* Assigned Tasks */}
                            {assignedTasks.length > 0 && (
                                <section className="drawer-section">
                                    <h3>Assigned Tasks ({assignedTasks.length})</h3>
                                    <div className="agent-tasks-list">
                                        {assignedTasks.map(t => (
                                            <div key={t._id} className="agent-task-item">
                                                <span className={`task-status-dot status-${t.status}`} />
                                                <span>{t.title}</span>
                                                {t.status === 'in_progress' ? (
                                                    <span className="session-status-badge working">Working</span>
                                                ) : (
                                                    <span className="muted">{t.status}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {/* ═══ FILES TAB ═══ */}
                    {activeTab === 'files' && (
                        <>
                            <section className="drawer-section">
                                <h3>SOUL.md</h3>
                                {loading && <p className="muted">Loading...</p>}
                                {!loading && soulEditing ? (
                                    <>
                                        <textarea
                                            className="soul-editor"
                                            value={soulDraft}
                                            onChange={e => setSoulDraft(e.target.value)}
                                            rows={16}
                                        />
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button className="btn-primary" onClick={handleSaveSoul} disabled={saving}>
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button className="btn-secondary" onClick={() => { setSoulEditing(false); setSoulDraft(soulContent || ''); }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </>
                                ) : !loading && soulContent ? (
                                    <>
                                        <pre className="soul-content">{soulContent}</pre>
                                        <button className="btn-secondary" onClick={() => setSoulEditing(true)} style={{ marginTop: 8 }}>
                                            ✏️ Edit SOUL.md
                                        </button>
                                    </>
                                ) : !loading && (
                                    <>
                                        <p className="muted">{soulError || 'No SOUL file found.'}</p>
                                        {workspacePath && (
                                            <p className="muted" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                                                Expected at: <code>{workspacePath}/SOUL.md</code>
                                            </p>
                                        )}
                                        <button className="btn-secondary" onClick={() => { setSoulDraft(''); setSoulEditing(true); }} style={{ marginTop: 8 }}>
                                            + Create SOUL.md
                                        </button>
                                    </>
                                )}
                            </section>

                            {/* Other Files */}
                            {agentFiles.length > 0 && (
                                <section className="drawer-section">
                                    <h3>Agent Files ({agentFiles.length})</h3>
                                    <div className="agent-files-list">
                                        {agentFiles.map(f => (
                                            <div key={f.path || f.name} className="agent-file-row">
                                                <span>📄 {f.path || f.name}</span>
                                                <span className="muted">{f.size ? `${(f.size / 1024).toFixed(1)}KB` : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {/* ═══ TOOLS TAB ═══ */}
                    {activeTab === 'tools' && (
                        <section className="drawer-section">
                            <h3>Tools</h3>
                            <div className="placeholder-section">
                                <span className="placeholder-icon">🔧</span>
                                <p>Tool configuration will be available when the gateway supports the <code>tools.list</code> API.</p>
                                <p className="muted">Tools allow agents to interact with external services, run code, browse the web, and more.</p>
                            </div>
                        </section>
                    )}

                    {/* ═══ SKILLS TAB ═══ */}
                    {activeTab === 'skills' && (
                        <section className="drawer-section">
                            <h3>Skills</h3>
                            <div className="placeholder-section">
                                <span className="placeholder-icon">📖</span>
                                <p>Skill configuration will be available when the gateway supports the <code>skills.list</code> API.</p>
                                <p className="muted">Skills are reusable workflows and instructions that agents can learn and apply.</p>
                            </div>
                        </section>
                    )}

                    {/* ═══ CHANNELS TAB ═══ */}
                    {activeTab === 'channels' && (
                        <section className="drawer-section">
                            <h3>Connected Channels</h3>
                            {inferredChannels.length > 0 ? (
                                <div className="agent-channels-list">
                                    {inferredChannels.map(ch => (
                                        <div key={ch} className="agent-channel-row">
                                            <span className="channel-name">{ch}</span>
                                            <span className="session-status-badge working">Active</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="muted">No channels detected from sessions.</p>
                            )}

                            {/* Sessions */}
                            <h3 style={{ marginTop: 20 }}>Sessions ({agentSessions.length})</h3>
                            {agentSessions.length === 0 && <p className="muted">No active sessions</p>}
                            {agentSessions.map(s => (
                                <div key={s.key || s.id} className="session-row">
                                    <span className="session-key">{s.key}</span>
                                    <span className={`status-dot ${s.active ? 'online' : 'offline'}`} />
                                </div>
                            ))}
                        </section>
                    )}

                    {/* ═══ CRON JOBS TAB ═══ */}
                    {activeTab === 'cron' && (
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
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
