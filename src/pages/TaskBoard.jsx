import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutGrid, Plus, X, MessageSquare, Loader,
    Check, XCircle, Archive, ChevronDown,
    ChevronRight, Zap, Play, ArrowRight, Eye,
} from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import { useTasks, useComments, useAllComments } from '../hooks/useConvexMission';
import { useTaskDispatch } from '../hooks/useTaskDispatch';
import useSessionSync from '../hooks/useSessionSync';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getAgentEmoji } from '../components/AgentCard';

/* ── Real channel icons ── */
import whatsappIcon from '../assets/icons/whatsapp.svg';
import discordIcon from '../assets/icons/discord.svg';
import slackIcon from '../assets/icons/slack.svg';
import telegramIcon from '../assets/icons/telegram.svg';
import webIcon from '../assets/icons/web.svg';

/* ──────────────────────────────────────────────────────
   TaskBoard — Kanban board for mission tasks
   v4.0: Liquid Glass design, simplified cards, real icons
   ────────────────────────────────────────────────────── */

const COLUMNS = [
    { id: 'inbox', label: 'Inbox', color: '#94a3b8', icon: null },
    { id: 'assigned', label: 'Assigned', color: '#60a5fa', icon: null },
    { id: 'in_progress', label: 'In Progress', color: '#f59e0b', icon: null },
    { id: 'review', label: 'Review', color: '#a855f7', icon: null },
    { id: 'done', label: 'Done', color: '#22c55e', icon: null },
    { id: 'blocked', label: 'Blocked', color: '#ef4444', icon: null },
];

/* ── Channel icon mapping (real SVG icons) ── */
const CHANNEL_META = {
    whatsapp: { icon: whatsappIcon, label: 'WhatsApp', color: '#25D366' },
    telegram: { icon: telegramIcon, label: 'Telegram', color: '#26A5E4' },
    discord: { icon: discordIcon, label: 'Discord', color: '#5865F2' },
    slack: { icon: slackIcon, label: 'Slack', color: '#E01E5A' },
    web: { icon: webIcon, label: 'Web', color: '#67e8f9' },
};

/**
 * ChannelIcon — renders the actual brand SVG icon for a channel
 * showLabel: also display the channel name next to the icon
 */
function ChannelIcon({ channel, size = 14, showLabel = false }) {
    if (!channel) return null;
    const meta = CHANNEL_META[channel];
    if (!meta) return null;
    if (showLabel) {
        return (
            <span className="channel-badge" style={{ '--ch-color': meta.color }}>
                <img src={meta.icon} alt={meta.label} className="channel-icon-img" width={size} height={size} />
                <span className="channel-badge-label">{meta.label}</span>
            </span>
        );
    }
    return (
        <img
            src={meta.icon}
            alt={meta.label}
            title={meta.label}
            className="channel-icon-img"
            width={size}
            height={size}
        />
    );
}

export default function TaskBoard() {
    const { tasks, updateTask } = useTasks();
    const agents = useMissionStore(s => s.agents);
    const setAgents = useMissionStore(s => s.setAgents);
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [showArchive, setShowArchive] = useState(false);
    const { resumeWatchers, stopAllWatchers } = useTaskDispatch();

    // Ensure agents are loaded (they may not be if user hasn't visited AgentsPage)
    useEffect(() => {
        if (agents.length > 0) return;
        const gw = getSelectedGateway();
        if (!gw?.connection) return;
        gw.connection.listAgents().then(res => {
            if (res?.agents) setAgents(res.agents);
            else if (Array.isArray(res)) setAgents(res);
        }).catch(() => { });
    }, [agents.length, getSelectedGateway]);
    const archiveTask = useMutation(api.tasks.archive);

    // Activate session sync — auto-detects sessions and creates tasks
    useSessionSync();

    // Resume watchers for in_progress tasks
    useEffect(() => {
        if (tasks.length > 0) resumeWatchers(tasks);
        return () => stopAllWatchers();
    }, [tasks.length]);

    const handleDrop = (columnId) => {
        if (draggedTask) {
            updateTask(draggedTask._id, { status: columnId });
            setDraggedTask(null);
        }
    };

    const liveSelectedTask = selectedTask
        ? tasks.find(t => t._id === selectedTask._id) || selectedTask
        : null;

    // Separate active vs archived tasks
    const activeTasks = tasks.filter(t => t.status !== 'archived');
    const archivedTasks = tasks.filter(t => t.status === 'archived');

    return (
        <motion.div className="page taskboard-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header">
                <div className="page-title">
                    <LayoutGrid size={22} />
                    <h1>Task Board</h1>
                    <span className="badge">{activeTasks.length}</span>
                </div>
                <div className="page-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        className="btn-secondary"
                        onClick={() => setShowArchive(!showArchive)}
                        style={{ fontSize: '0.78rem', gap: 4 }}
                    >
                        <Archive size={14} />
                        Archive ({archivedTasks.length})
                        {showArchive ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <button className="btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={14} /> New Task
                    </button>
                </div>
            </div>

            <div className="glass-board">
                {COLUMNS.map(col => {
                    const colTasks = activeTasks.filter(t => t.status === col.id);
                    return (
                        <div
                            key={col.id}
                            className="glass-column"
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => handleDrop(col.id)}
                        >
                            <div className="glass-column-header">
                                <span className="glass-column-dot" style={{ background: col.color }} />
                                <span>{col.label}</span>
                                <span className="glass-column-count">{colTasks.length}</span>
                            </div>
                            <div className="glass-column-body">
                                <AnimatePresence>
                                    {colTasks.map(task => (
                                        <TaskCard
                                            key={task._id}
                                            task={task}
                                            agents={agents}
                                            onClick={() => setSelectedTask(task)}
                                            onDragStart={() => setDraggedTask(task)}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Archived Tasks Section */}
            <AnimatePresence>
                {showArchive && archivedTasks.length > 0 && (
                    <motion.div
                        className="archived-section"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <h3 style={{ margin: '16px 0 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <Archive size={14} style={{ marginRight: 6 }} />
                            Archived ({archivedTasks.length})
                        </h3>
                        <div className="archived-list">
                            {archivedTasks.map(task => (
                                <motion.div
                                    key={task._id}
                                    className="archived-card"
                                    onClick={() => setSelectedTask(task)}
                                    whileHover={{ x: 2 }}
                                >
                                    <div className="archived-card-left">
                                        <span className="task-assignees">
                                            {task.assigneeIds?.map(id => {
                                                const agent = agents.find(a => (a.agentId || a.id) === id);
                                                return <span key={id} title={agent?.name || id}>{agent?.emoji || getAgentEmoji(id)}</span>;
                                            })}
                                        </span>
                                        <span className="archived-title">{task.title}</span>
                                    </div>
                                    <div className="archived-card-right">
                                        {task.channel && <ChannelIcon channel={task.channel} />}
                                        <span className="archived-date">
                                            {task.archivedAt ? new Date(task.archivedAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCreate && <CreateTaskModal agents={agents} onClose={() => setShowCreate(false)} />}
            </AnimatePresence>

            <AnimatePresence>
                {liveSelectedTask && (
                    <TaskDetail
                        task={liveSelectedTask}
                        agents={agents}
                        onClose={() => setSelectedTask(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   TaskCard — Agent avatar, channel icon, sub-agent lineage
   ══════════════════════════════════════════════ */

/**
 * Infer missing channel/isSubAgent from sessionKey, source, or title.
 * Backward-compatible for tasks created before the schema update.
 */
function inferTaskMeta(task) {
    const key = task.sessionKey || '';
    const source = task.source || '';
    const title = task.title || '';

    // Infer channel from task.channel (new) or from source/key/title (old)
    let channel = task.channel;
    if (!channel) {
        if (source.includes('whatsapp') || key.includes('whatsapp') || title.startsWith('WhatsApp')) channel = 'whatsapp';
        else if (source.includes('discord') || key.includes('discord') || title.startsWith('Discord')) channel = 'discord';
        else if (source.includes('slack') || key.includes('slack') || title.startsWith('Slack')) channel = 'slack';
        else if (source.includes('telegram') || key.includes('telegram') || title.startsWith('Telegram')) channel = 'telegram';
    }

    // Infer sub-agent status from sessionKey pattern: agent:*:subagent:*
    const isSubAgent = !!(task.spawnedBy || key.includes(':subagent:'));
    // Extract parent agent from spawnedBy or from sessionKey
    let parentAgentId = null;
    if (task.spawnedBy) {
        const parts = task.spawnedBy.split(':');
        parentAgentId = parts.length >= 2 && parts[0] === 'agent' ? parts[1] : task.spawnedBy;
    } else if (key.includes(':subagent:')) {
        // e.g. agent:main:subagent:abc → parent is "main"
        const parts = key.split(':');
        parentAgentId = parts[1] || 'main';
    }

    // Clean up old "Source → agent" titles
    let displayTitle = title;
    const arrowMatch = title.match(/^(Discord|WhatsApp|Telegram|Slack|Gateway)\s*(?:→|->|→)\s*(\w+)$/i);
    if (arrowMatch) {
        // Old format → replace with something better
        if (isSubAgent) {
            displayTitle = `Sub-task (${arrowMatch[2]})`;
        } else {
            displayTitle = `Task from ${arrowMatch[1]}`;
        }
    }

    return { channel, isSubAgent, parentAgentId, displayTitle };
}

function TaskCard({ task, agents, onClick, onDragStart }) {
    const { channel, isSubAgent, parentAgentId, displayTitle } = inferTaskMeta(task);

    const agentId = task.assigneeIds?.[0];
    const agent = agents.find(a => (a.agentId || a.id) === agentId);
    const agentEmoji = agent?.emoji || getAgentEmoji(agentId || '');
    const agentName = agent?.name || agentId || 'Unassigned';
    const description = task.description || '';

    return (
        <motion.div
            className={`glass-card ${isSubAgent ? 'glass-card--sub' : ''}`}
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            whileHover={{ y: -3, scale: 1.015 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
            {/* Top row: avatar + agent name + status */}
            <div className="glass-card-top">
                <span className="glass-avatar-emoji">{agentEmoji}</span>
                <span className="glass-card-agent">{agentName}</span>
                <div className="glass-card-indicators">
                    {isSubAgent && (
                        <span className="glass-sub-dot" title={`Sub-agent of ${parentAgentId || 'parent'}`} />
                    )}
                    {task.status === 'in_progress' && (
                        <Loader size={13} className="spin-icon glass-working" />
                    )}
                </div>
            </div>

            {/* Task title — multi-line */}
            <div className="glass-card-title">{displayTitle}</div>

            {/* Description preview */}
            {description && (
                <div className="glass-card-desc">{description.slice(0, 120)}{description.length > 120 ? '…' : ''}</div>
            )}

            {/* Channel badge: icon + name */}
            {channel && (
                <div className="glass-card-footer">
                    <ChannelIcon channel={channel} size={14} showLabel />
                </div>
            )}
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   CreateTaskModal
   ══════════════════════════════════════════════ */

function CreateTaskModal({ agents, onClose }) {
    const { addTask } = useTasks();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignees, setAssignees] = useState([]);
    const [channel, setChannel] = useState('');

    const CHANNEL_OPTIONS = [
        { value: '', label: 'No channel (Gateway)' },
        { value: 'discord', label: 'Discord' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'slack', label: 'Slack' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'web', label: 'Web' },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await addTask(title, description, assignees, channel);
        onClose();
    };

    const toggleAssignee = (id) => {
        setAssignees(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
    };

    return (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div
                className="modal create-task-modal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>Create Task</h2>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Create competitor comparison page"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Describe the task..."
                            rows={4}
                        />
                    </div>
                    <div className="form-group">
                        <label>Channel</label>
                        <div className="channel-picker">
                            {CHANNEL_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`channel-pick ${channel === opt.value ? 'selected' : ''}`}
                                    onClick={() => setChannel(opt.value)}
                                >
                                    {opt.value ? <ChannelIcon channel={opt.value} size={16} /> : <MessageSquare size={16} />}
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {agents.length > 0 && (
                        <div className="form-group">
                            <label>Assign Agents {assignees.length > 0 && <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}> → auto-assigns</span>}</label>
                            <div className="agent-picker">
                                {agents.map(a => {
                                    const id = a.agentId || a.id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`agent-pick ${assignees.includes(id) ? 'selected' : ''}`}
                                            onClick={() => toggleAssignee(id)}
                                        >
                                            <span>{a.emoji || getAgentEmoji(id)}</span>
                                            <span>{a.name || id}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 12, gap: 6 }}>
                        <Plus size={14} /> Create Task
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   TaskDetail — Enhanced with chat-style replies + review + archive
   ══════════════════════════════════════════════ */

function TaskDetail({ task, agents, onClose }) {
    const { comments, addComment } = useComments(task._id);
    const updateTaskMutation = useMutation(api.tasks.update);
    const removeTaskMutation = useMutation(api.tasks.remove);
    const archiveTaskMutation = useMutation(api.tasks.archive);
    const addActivity = useMutation(api.activities.add);
    const { dispatchTask, tailSession } = useTaskDispatch();
    const connectedGw = useGatewayStore(s => s.getSelectedGateway)();

    const [commentText, setCommentText] = useState('');
    const [dispatching, setDispatching] = useState(false);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [editAssignees, setEditAssignees] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const agentId = task.assigneeIds?.[0] || null;

    // Tail the session for live updates
    useEffect(() => {
        if (!task.sessionKey && task.status !== 'in_progress') return;
        if (task.status !== 'in_progress' && task.status !== 'review' && task.status !== 'done') return;
        let active = true;
        const poll = async () => {
            const result = await tailSession(task.sessionKey, agentId);
            if (!active) return;
            if (result?.correctedKey) {
                await updateTaskMutation({
                    id: task._id,
                    patch: { sessionKey: result.correctedKey },
                });
                setSessionMessages(Array.isArray(result.messages) ? result.messages : []);
            } else if (Array.isArray(result)) {
                setSessionMessages(result);
            } else if (result?.messages) {
                setSessionMessages(Array.isArray(result.messages) ? result.messages : []);
            }
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [task.sessionKey, task.status, agentId]);

    const handleComment = async () => {
        if (!commentText.trim()) return;
        await addComment(commentText, 'user');
        setCommentText('');
    };

    const handleDispatch = async () => {
        setDispatching(true);
        try { await dispatchTask(task); }
        catch (err) { console.error('Dispatch failed:', err); }
        setDispatching(false);
    };

    const handleApprove = async () => {
        await updateTaskMutation({ id: task._id, patch: { status: 'done' } });
        if (connectedGw) {
            await addActivity({
                gatewayId: connectedGw.id,
                type: 'task_approved',
                agentName: 'reviewer',
                message: `Approved "${task.title}" → Done ✅`,
            });
        }
        await addComment(`✅ Task approved and marked as done`, 'reviewer');
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        await updateTaskMutation({ id: task._id, patch: { status: 'blocked' } });
        if (connectedGw) {
            await addActivity({
                gatewayId: connectedGw.id,
                type: 'task_rejected',
                agentName: 'reviewer',
                message: `Rejected "${task.title}" → Blocked: ${rejectReason}`,
            });
        }
        await addComment(`❌ Task rejected: ${rejectReason}`, 'reviewer');
        setRejectReason('');
        setShowRejectInput(false);
    };

    const handleArchive = async () => {
        await archiveTaskMutation({ id: task._id });
        onClose();
    };

    const toggleAssignee = (id) => {
        const current = task.assigneeIds || [];
        const updated = current.includes(id) ? current.filter(a => a !== id) : [...current, id];
        updateTaskMutation({ id: task._id, patch: { assigneeIds: updated } });
    };

    const canDispatch = task.status === 'assigned' && (task.assigneeIds?.length > 0) && connectedGw?.status === 'connected';

    return (
        <motion.div className="drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div
                className="drawer task-detail-drawer"
                initial={{ x: 500 }} animate={{ x: 0 }} exit={{ x: 500 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="drawer-header">
                    <h2>{task.title}</h2>
                    <button className="btn-icon" onClick={onClose}>&times;</button>
                </div>
                <div className="drawer-body">
                    {/* Task Meta — source + timestamps */}
                    <section className="drawer-section" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {task.channel && <ChannelIcon channel={task.channel} />}
                        {task.sessionKey && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {task.sessionKey}
                            </span>
                        )}
                        {task.completedAt && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-green)' }}>
                                ✓ Completed {new Date(task.completedAt).toLocaleString()}
                            </span>
                        )}
                    </section>

                    {/* Status */}
                    <section className="drawer-section">
                        <h3>Status</h3>
                        <div className="status-picker">
                            {COLUMNS.map(col => (
                                <button
                                    key={col.id}
                                    className={`status-pick ${task.status === col.id ? 'active' : ''}`}
                                    style={{ '--col': col.color }}
                                    onClick={() => updateTaskMutation({ id: task._id, patch: { status: col.id } })}
                                >
                                    {col.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Description */}
                    <section className="drawer-section">
                        <h3>Description</h3>
                        <p className={task.description ? '' : 'muted'}>{task.description || 'No description'}</p>
                    </section>

                    {/* Assignees (editable) */}
                    <section className="drawer-section">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            Assignees
                            {agents.length > 0 && (
                                <button
                                    className="btn-secondary"
                                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                    onClick={() => setEditAssignees(!editAssignees)}
                                >
                                    {editAssignees ? 'Done' : 'Edit'}
                                </button>
                            )}
                        </h3>
                        {editAssignees ? (
                            <div className="agent-picker">
                                {agents.map(a => {
                                    const id = a.agentId || a.id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`agent-pick ${(task.assigneeIds || []).includes(id) ? 'selected' : ''}`}
                                            onClick={() => toggleAssignee(id)}
                                        >
                                            <span>{a.emoji || getAgentEmoji(id)}</span>
                                            <span>{a.name || id}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="task-assignees-list">
                                {(task.assigneeIds || []).map(id => {
                                    const agent = agents.find(a => (a.agentId || a.id) === id);
                                    return (
                                        <span key={id} className="assignee-chip">
                                            {agent?.emoji || getAgentEmoji(id)} {agent?.name || id}
                                        </span>
                                    );
                                })}
                                {(!task.assigneeIds || task.assigneeIds.length === 0) && (
                                    <span className="muted">No assignees</span>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ▶ Start Work / Live Session */}
                    {(task.status === 'assigned' || task.status === 'in_progress') && (
                        <section className="drawer-section task-dispatch-section">
                            {task.status === 'assigned' && (
                                <>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Zap size={14} style={{ color: 'var(--accent-green)' }} />
                                        Agent Execution
                                    </h3>
                                    <button
                                        className={`btn-dispatch ${dispatching ? 'dispatching' : ''}`}
                                        onClick={handleDispatch}
                                        disabled={!canDispatch || dispatching}
                                    >
                                        {dispatching ? (
                                            <><Loader size={14} className="spin-icon" /> Dispatching...</>
                                        ) : (
                                            <><Play size={14} /> Start Work</>
                                        )}
                                    </button>
                                    {!connectedGw?.status?.includes('connected') && (
                                        <p className="muted" style={{ fontSize: '0.75rem', marginTop: 6 }}>
                                            ⚠ Gateway not connected
                                        </p>
                                    )}
                                </>
                            )}
                            {task.status === 'in_progress' && (
                                <>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Loader size={14} className="spin-icon" style={{ color: 'var(--accent-amber)' }} />
                                        Agent Working
                                        <button
                                            className="btn-secondary"
                                            style={{ fontSize: '0.65rem', padding: '2px 8px', marginLeft: 'auto' }}
                                            onClick={() => updateTaskMutation({ id: task._id, patch: { status: 'review' } })}
                                        >
                                            <ArrowRight size={10} /> Mark Complete
                                        </button>
                                    </h3>
                                    {task.sessionKey && (
                                        <AgentChatFeed messages={sessionMessages} agents={agents} task={task} />
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {/* 🔍 Review Workflow */}
                    {task.status === 'review' && (
                        <section className="drawer-section review-section">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Eye size={14} style={{ color: 'var(--accent-purple)' }} />
                                Review Agent Output
                            </h3>
                            {task.sessionKey && sessionMessages.length > 0 && (
                                <AgentChatFeed messages={sessionMessages} agents={agents} task={task} />
                            )}
                            <div className="review-actions" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <button className="btn-primary" style={{ background: '#22c55e', flex: 1, gap: 6 }} onClick={handleApprove}>
                                    <Check size={14} /> Approve → Done
                                </button>
                                {!showRejectInput ? (
                                    <button className="btn-primary" style={{ background: '#ef4444', flex: 1, gap: 6 }} onClick={() => setShowRejectInput(true)}>
                                        <XCircle size={14} /> Reject → Blocked
                                    </button>
                                ) : (
                                    <div style={{ flex: '1 0 100%', display: 'flex', gap: 6 }}>
                                        <input
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleReject()}
                                            placeholder="Reason for rejection..."
                                            autoFocus
                                            style={{ flex: 1, fontSize: '0.8rem' }}
                                        />
                                        <button className="btn-primary" style={{ background: '#ef4444', fontSize: '0.75rem', padding: '4px 10px' }} onClick={handleReject} disabled={!rejectReason.trim()}>
                                            Reject
                                        </button>
                                        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => setShowRejectInput(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Done → show session output + archive button */}
                    {task.status === 'done' && (
                        <section className="drawer-section">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Check size={14} style={{ color: 'var(--accent-green)' }} />
                                Completed
                                {task.completedAt && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                        {new Date(task.completedAt).toLocaleString()}
                                    </span>
                                )}
                            </h3>
                            {task.sessionKey && sessionMessages.length > 0 && (
                                <AgentChatFeed messages={sessionMessages} agents={agents} task={task} />
                            )}
                            <button
                                className="btn-secondary"
                                style={{ marginTop: 12, gap: 6 }}
                                onClick={handleArchive}
                            >
                                <Archive size={14} /> Archive Task
                            </button>
                        </section>
                    )}

                    {/* Comments Thread */}
                    <section className="drawer-section comments-section">
                        <h3>Comments ({comments.length})</h3>
                        <div className="comments-list">
                            {comments.map(c => (
                                <div key={c._id} className={`comment ${c.fromAgent === 'reviewer' ? 'comment-reviewer' : c.fromAgent === 'user' ? 'comment-user' : 'comment-agent'}`}>
                                    <div className="comment-header">
                                        <span className="comment-author">
                                            {c.fromAgent === 'reviewer' ? '👁‍🗨 Reviewer' : c.fromAgent === 'user' ? '👤 You' : `🤖 ${c.fromAgent}`}
                                        </span>
                                        <span className="comment-time">{new Date(c.ts).toLocaleString()}</span>
                                    </div>
                                    <div className="comment-body" style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                                </div>
                            ))}
                        </div>
                        <div className="comment-input-bar">
                            <input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleComment()}
                                placeholder="Add a comment..."
                            />
                            <button className="btn-send" onClick={handleComment} disabled={!commentText.trim()}>
                                <MessageSquare size={14} />
                            </button>
                        </div>
                    </section>

                    {/* Danger zone */}
                    <section className="drawer-section danger-section">
                        <button className="btn-danger" onClick={() => { removeTaskMutation({ id: task._id }); onClose(); }}>
                            Delete Task
                        </button>
                    </section>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   AgentChatFeed — Chat-style session messages
   ══════════════════════════════════════════════ */

function AgentChatFeed({ messages, agents, task }) {
    if (!messages || messages.length === 0) {
        return (
            <div className="session-live-feed">
                <div className="feed-line muted" style={{ textAlign: 'center', padding: 16 }}>
                    <Loader size={14} className="spin-icon" style={{ display: 'inline-block', marginRight: 6 }} />
                    Waiting for agent response...
                </div>
            </div>
        );
    }

    const agentId = task.assigneeIds?.[0];
    const agent = agents.find(a => (a.agentId || a.id) === agentId);
    const agentEmoji = agent?.emoji || getAgentEmoji(agentId || '');

    return (
        <div className="session-live-feed chat-feed">
            {messages.map((msg, i) => {
                const isAgent = msg.role === 'assistant';
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content || '', null, 2);
                if (!content.trim()) return null;
                return (
                    <motion.div
                        key={i}
                        className={`chat-bubble ${isAgent ? 'agent' : 'user'}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                    >
                        <div className="chat-avatar">
                            {isAgent ? agentEmoji : '📤'}
                        </div>
                        <div className="chat-content">
                            <div className="chat-role">
                                {isAgent ? (agent?.name || agentId || 'Agent') : 'Task Input'}
                            </div>
                            <div className="chat-text">
                                {content.length > 600 ? content.slice(0, 600) + '...' : content}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
            {task.status === 'in_progress' && (
                <div className="chat-typing">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
            )}
        </div>
    );
}
