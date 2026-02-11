import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, X, MessageSquare, Play, Loader, Zap, Check, XCircle, Eye, Bot, ArrowRight } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import { useTasks, useComments, useAllComments } from '../hooks/useConvexMission';
import { useTaskDispatch } from '../hooks/useTaskDispatch';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getAgentEmoji } from '../components/AgentCard';

/* ──────────────────────────────────────────────────────
   TaskBoard — Kanban board for mission tasks
   v2.5: Live agent replies + review workflow
   ────────────────────────────────────────────────────── */

const COLUMNS = [
    { id: 'inbox', label: 'Inbox', color: '#94a3b8' },
    { id: 'assigned', label: 'Assigned', color: '#60a5fa' },
    { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { id: 'review', label: 'Review', color: '#a855f7' },
    { id: 'done', label: 'Done', color: '#22c55e' },
    { id: 'blocked', label: 'Blocked', color: '#ef4444' },
];

export default function TaskBoard() {
    const { tasks, updateTask } = useTasks();
    const agents = useMissionStore(s => s.agents);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const { resumeWatchers, stopAllWatchers } = useTaskDispatch();

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

    return (
        <motion.div className="page taskboard-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header">
                <div className="page-title">
                    <LayoutGrid size={22} />
                    <h1>Task Board</h1>
                    <span className="badge">{tasks.length}</span>
                </div>
                <div className="page-actions">
                    <button className="btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={14} /> New Task
                    </button>
                </div>
            </div>

            <div className="kanban-board">
                {COLUMNS.map(col => {
                    const colTasks = tasks.filter(t => t.status === col.id);
                    return (
                        <div
                            key={col.id}
                            className="kanban-column"
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => handleDrop(col.id)}
                        >
                            <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                                <span className="kanban-column-dot" style={{ background: col.color }} />
                                <span>{col.label}</span>
                                <span className="kanban-count">{colTasks.length}</span>
                            </div>
                            <div className="kanban-column-body">
                                <AnimatePresence>
                                    {colTasks.map(task => (
                                        <TaskCard
                                            key={task._id}
                                            task={task}
                                            agents={agents}
                                            onClick={() => setSelectedTask(task)}
                                            onDragStart={() => setDraggedTask(task)}
                                            onQuickAction={(status) => updateTask(task._id, { status })}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>

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
   TaskCard — Enhanced with status indicators + quick actions
   ══════════════════════════════════════════════ */

function TaskCard({ task, agents, onClick, onDragStart, onQuickAction }) {
    const allComments = useAllComments();
    const comments = allComments.filter(c => c.taskId === task._id);

    // Get last agent comment for preview
    const lastAgentComment = comments.filter(c => c.fromAgent !== 'user').slice(-1)[0];

    return (
        <motion.div
            className="task-card"
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -1 }}
        >
            <h4 className="task-title">{task.title}</h4>
            {task.description && (
                <p className="task-desc">{task.description.slice(0, 80)}{task.description.length > 80 ? '...' : ''}</p>
            )}

            {/* Last agent message preview */}
            {lastAgentComment && task.status !== 'inbox' && (
                <div style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    padding: '4px 6px',
                    background: 'var(--bg-primary)',
                    borderRadius: 4,
                    marginTop: 4,
                    lineHeight: 1.3,
                    display: 'flex',
                    gap: 4,
                    alignItems: 'flex-start',
                }}>
                    <Bot size={10} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{lastAgentComment.content.slice(0, 100)}{lastAgentComment.content.length > 100 ? '...' : ''}</span>
                </div>
            )}

            <div className="task-meta">
                <div className="task-assignees">
                    {task.assigneeIds?.map(id => {
                        const agent = agents.find(a => (a.agentId || a.id) === id);
                        return (
                            <span key={id} className="task-assignee-avatar" title={agent?.name || id}>
                                {agent?.emoji || getAgentEmoji(id)}
                            </span>
                        );
                    })}
                </div>

                {/* Status indicators */}
                {task.status === 'in_progress' && (
                    <span className="session-status-badge working">
                        <Loader size={10} className="spin-icon" /> Working
                    </span>
                )}

                {/* Quick action buttons for Review column */}
                {task.status === 'review' && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
                        <button
                            className="quick-review-btn approve"
                            title="Approve → Done"
                            onClick={() => onQuickAction('done')}
                        >
                            <Check size={12} />
                        </button>
                        <button
                            className="quick-review-btn reject"
                            title="Reject → Blocked"
                            onClick={() => onQuickAction('blocked')}
                        >
                            <XCircle size={12} />
                        </button>
                    </div>
                )}

                {comments.length > 0 && (
                    <span className="task-comment-count">
                        <MessageSquare size={11} /> {comments.length}
                    </span>
                )}
            </div>
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await addTask(title, description, assignees);
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
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={!title.trim()}>Create Task</button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

/* ══════════════════════════════════════════════
   TaskDetail — Enhanced with chat-style replies + review workflow
   ══════════════════════════════════════════════ */

function TaskDetail({ task, agents, onClose }) {
    const { comments, addComment } = useComments(task._id);
    const updateTaskMutation = useMutation(api.tasks.update);
    const removeTaskMutation = useMutation(api.tasks.remove);
    const addActivity = useMutation(api.activities.add);
    const { dispatchTask, tailSession } = useTaskDispatch();
    const connectedGw = useGatewayStore(s => s.getSelectedGateway)();

    const [commentText, setCommentText] = useState('');
    const [dispatching, setDispatching] = useState(false);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [editAssignees, setEditAssignees] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Tail the session for live updates (works for in_progress AND review)
    useEffect(() => {
        if (!task.sessionKey) return;
        if (task.status !== 'in_progress' && task.status !== 'review') return;
        let active = true;
        const poll = async () => {
            const msgs = await tailSession(task.sessionKey);
            if (active && msgs) setSessionMessages(Array.isArray(msgs) ? msgs : []);
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [task.sessionKey, task.status]);

    const handleComment = async () => {
        if (!commentText.trim()) return;
        await addComment(commentText, 'user');
        setCommentText('');
    };

    const handleDispatch = async () => {
        setDispatching(true);
        try {
            await dispatchTask(task);
        } catch (err) {
            console.error('Dispatch failed:', err);
        }
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

                            {/* Show agent's session output for review */}
                            {task.sessionKey && sessionMessages.length > 0 && (
                                <AgentChatFeed messages={sessionMessages} agents={agents} task={task} />
                            )}

                            {/* Review action buttons */}
                            <div className="review-actions" style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 12,
                                flexWrap: 'wrap',
                            }}>
                                <button
                                    className="btn-primary"
                                    style={{ background: '#22c55e', flex: 1, gap: 6 }}
                                    onClick={handleApprove}
                                >
                                    <Check size={14} /> Approve → Done
                                </button>
                                {!showRejectInput ? (
                                    <button
                                        className="btn-primary"
                                        style={{ background: '#ef4444', flex: 1, gap: 6 }}
                                        onClick={() => setShowRejectInput(true)}
                                    >
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
                                        <button
                                            className="btn-primary"
                                            style={{ background: '#ef4444', fontSize: '0.75rem', padding: '4px 10px' }}
                                            onClick={handleReject}
                                            disabled={!rejectReason.trim()}
                                        >
                                            Reject
                                        </button>
                                        <button
                                            className="btn-secondary"
                                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                            onClick={() => setShowRejectInput(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
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

                // Skip empty messages or tool_use blocks
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
