import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, X, MessageSquare, Play, Loader, Zap } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';
import { useTasks, useComments, useAllComments } from '../hooks/useConvexMission';
import { useTaskDispatch } from '../hooks/useTaskDispatch';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getAgentEmoji } from '../components/AgentCard';

/* ──────────────────────────────────────────────────────
   TaskBoard — Kanban board for mission tasks
   v2.2: Auto-assign + Start Work dispatch + live session
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

function TaskCard({ task, agents, onClick, onDragStart }) {
    const allComments = useAllComments();
    const comments = allComments.filter(c => c.taskId === task._id);

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
                {task.status === 'in_progress' && (
                    <span className="session-status-badge working">
                        <Loader size={10} className="spin-icon" /> Working
                    </span>
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

function TaskDetail({ task, agents, onClose }) {
    const { comments, addComment } = useComments(task._id);
    const updateTaskMutation = useMutation(api.tasks.update);
    const removeTaskMutation = useMutation(api.tasks.remove);
    const { dispatchTask, tailSession } = useTaskDispatch();
    const connectedGw = useGatewayStore(s => s.getSelectedGateway)();

    const [commentText, setCommentText] = useState('');
    const [dispatching, setDispatching] = useState(false);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [editAssignees, setEditAssignees] = useState(false);

    // Tail the session for live updates
    useEffect(() => {
        if (!task.sessionKey || task.status !== 'in_progress') return;
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
        await addComment(commentText);
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
                                    </h3>
                                    {task.sessionKey && (
                                        <div className="session-live-feed">
                                            {sessionMessages.length === 0 ? (
                                                <div className="feed-line muted">Waiting for agent response...</div>
                                            ) : (
                                                sessionMessages.map((msg, i) => (
                                                    <div key={i} className={`feed-line ${msg.role === 'assistant' ? 'agent' : ''}`}>
                                                        <strong>{msg.role === 'assistant' ? '🤖' : '📤'}</strong>{' '}
                                                        {typeof msg.content === 'string' ? msg.content.slice(0, 300) : JSON.stringify(msg.content).slice(0, 300)}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {/* Comments Thread */}
                    <section className="drawer-section comments-section">
                        <h3>Comments ({comments.length})</h3>
                        <div className="comments-list">
                            {comments.map(c => (
                                <div key={c._id} className="comment">
                                    <div className="comment-header">
                                        <span className="comment-author">{c.fromAgent}</span>
                                        <span className="comment-time">{new Date(c.ts).toLocaleString()}</span>
                                    </div>
                                    <div className="comment-body">{c.content}</div>
                                </div>
                            ))}
                        </div>
                        <div className="comment-input-bar">
                            <input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleComment()}
                                placeholder="Add a comment... use @agent to mention"
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
