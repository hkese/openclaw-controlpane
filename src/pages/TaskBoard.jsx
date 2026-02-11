import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Plus, X, MessageSquare, User, GripVertical, FileText } from 'lucide-react';
import useMissionStore from '../stores/useMissionStore';
import { getAgentEmoji } from '../components/AgentCard';

/* ──────────────────────────────────────────────────────
   TaskBoard — Kanban board for mission tasks
   Columns: Inbox → Assigned → In Progress → Review → Done → Blocked
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
    const tasks = useMissionStore(s => s.tasks);
    const agents = useMissionStore(s => s.agents);
    const updateTask = useMissionStore(s => s.updateTask);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);

    const handleDrop = (columnId) => {
        if (draggedTask) {
            updateTask(draggedTask.id, { status: columnId });
            setDraggedTask(null);
        }
    };

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
                                            key={task.id}
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

            {/* Create Task Modal */}
            <AnimatePresence>
                {showCreate && <CreateTaskModal agents={agents} onClose={() => setShowCreate(false)} />}
            </AnimatePresence>

            {/* Task Detail */}
            <AnimatePresence>
                {selectedTask && (
                    <TaskDetail
                        task={selectedTask}
                        agents={agents}
                        onClose={() => setSelectedTask(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function TaskCard({ task, agents, onClick, onDragStart }) {
    const allComments = useMissionStore(s => s.comments);
    const comments = useMemo(() => allComments.filter(c => c.taskId === task.id), [allComments, task.id]);

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
    const addTask = useMissionStore(s => s.addTask);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assignees, setAssignees] = useState([]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        addTask(title, description, assignees);
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
                            <label>Assign Agents</label>
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
    const allComments = useMissionStore(s => s.comments);
    const comments = useMemo(() => allComments.filter(c => c.taskId === task.id), [allComments, task.id]);
    const addComment = useMissionStore(s => s.addComment);
    const updateTask = useMissionStore(s => s.updateTask);
    const deleteTask = useMissionStore(s => s.deleteTask);
    const [commentText, setCommentText] = useState('');

    const handleComment = () => {
        if (!commentText.trim()) return;
        addComment(task.id, commentText);
        setCommentText('');
    };

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
                                    onClick={() => updateTask(task.id, { status: col.id })}
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

                    {/* Assignees */}
                    <section className="drawer-section">
                        <h3>Assignees</h3>
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
                    </section>

                    {/* Comments Thread */}
                    <section className="drawer-section comments-section">
                        <h3>Comments ({comments.length})</h3>
                        <div className="comments-list">
                            {comments.map(c => (
                                <div key={c.id} className="comment">
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
                        <button className="btn-danger" onClick={() => { deleteTask(task.id); onClose(); }}>
                            Delete Task
                        </button>
                    </section>
                </div>
            </motion.div>
        </motion.div>
    );
}
