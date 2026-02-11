import { create } from 'zustand';

/*  ──────────────────────────────────────────────────────
    useMissionStore — Local state for Mission Control
    Manages tasks, comments, documents, activity, and
    agent metadata that lives client-side (localStorage).
    ────────────────────────────────────────────────────── */

const STORAGE_KEY = 'openclaw-mission-control';

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function persist(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            tasks: state.tasks,
            comments: state.comments,
            documents: state.documents,
            activities: state.activities,
            notifications: state.notifications,
        }));
    } catch { /* quota exceeded — fail silently */ }
}

function uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT = {
    tasks: [],
    comments: [],
    documents: [],
    activities: [],
    notifications: [],
};

const saved = loadState() || DEFAULT;

const useMissionStore = create((set, get) => ({
    // ─── State ───
    tasks: saved.tasks,
    comments: saved.comments,
    documents: saved.documents,
    activities: saved.activities,
    notifications: saved.notifications,

    // Live data fetched from Gateway (not persisted)
    agents: [],          // from agents.list
    sessions: [],        // from sessions.list
    cronJobs: [],        // from cron.list
    models: [],          // from models.list

    // ─── Activity helpers ───
    _addActivity: (type, agentName, message) => {
        const entry = { id: uid(), type, agentName, message, ts: Date.now() };
        set(state => {
            const activities = [entry, ...state.activities].slice(0, 500);
            const next = { ...state, activities };
            persist(next);
            return { activities };
        });
    },

    // ─── Tasks CRUD ───
    addTask: (title, description = '', assigneeIds = []) => {
        const task = {
            id: uid(),
            title,
            description,
            status: 'inbox',
            assigneeIds,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        set(state => {
            const tasks = [...state.tasks, task];
            const next = { ...state, tasks };
            persist(next);
            return { tasks };
        });
        get()._addActivity('task_created', 'You', `Created task: ${title}`);
        return task;
    },

    updateTask: (id, patch) => {
        set(state => {
            const tasks = state.tasks.map(t =>
                t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
            );
            const next = { ...state, tasks };
            persist(next);
            return { tasks };
        });
        if (patch.status) {
            const task = get().tasks.find(t => t.id === id);
            get()._addActivity('task_status', 'You', `Moved "${task?.title}" to ${patch.status}`);
        }
    },

    deleteTask: (id) => {
        const task = get().tasks.find(t => t.id === id);
        set(state => {
            const tasks = state.tasks.filter(t => t.id !== id);
            const comments = state.comments.filter(c => c.taskId !== id);
            const next = { ...state, tasks, comments };
            persist(next);
            return { tasks, comments };
        });
        if (task) get()._addActivity('task_deleted', 'You', `Deleted task: ${task.title}`);
    },

    // ─── Comments ───
    addComment: (taskId, content, fromAgent = 'You') => {
        const comment = {
            id: uid(),
            taskId,
            content,
            fromAgent,
            ts: Date.now(),
        };
        set(state => {
            const comments = [...state.comments, comment];
            const next = { ...state, comments };
            persist(next);
            return { comments };
        });
        // Extract @mentions
        const mentions = content.match(/@(\w+)/g) || [];
        mentions.forEach(m => {
            get()._addNotification(m.slice(1), `${fromAgent} mentioned you: "${content.slice(0, 80)}"`);
        });
        get()._addActivity('comment_added', fromAgent, `Commented on task`);
        return comment;
    },

    getTaskComments: (taskId) => {
        return get().comments.filter(c => c.taskId === taskId);
    },

    // ─── Documents ───
    addDocument: (title, content, type = 'deliverable', taskId = null) => {
        const doc = {
            id: uid(),
            title,
            content,
            type,
            taskId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        set(state => {
            const documents = [...state.documents, doc];
            const next = { ...state, documents };
            persist(next);
            return { documents };
        });
        get()._addActivity('document_created', 'You', `Created document: ${title}`);
        return doc;
    },

    updateDocument: (id, patch) => {
        set(state => {
            const documents = state.documents.map(d =>
                d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d
            );
            const next = { ...state, documents };
            persist(next);
            return { documents };
        });
    },

    deleteDocument: (id) => {
        set(state => {
            const documents = state.documents.filter(d => d.id !== id);
            const next = { ...state, documents };
            persist(next);
            return { documents };
        });
    },

    // ─── Notifications ───
    _addNotification: (agentName, content) => {
        const notif = {
            id: uid(),
            agentName,
            content,
            delivered: false,
            ts: Date.now(),
        };
        set(state => {
            const notifications = [notif, ...state.notifications].slice(0, 200);
            const next = { ...state, notifications };
            persist(next);
            return { notifications };
        });
    },

    markNotificationDelivered: (id) => {
        set(state => {
            const notifications = state.notifications.map(n =>
                n.id === id ? { ...n, delivered: true } : n
            );
            const next = { ...state, notifications };
            persist(next);
            return { notifications };
        });
    },

    // ─── Gateway data setters (not persisted) ───
    setAgents: (agents) => set({ agents }),
    setSessions: (sessions) => set({ sessions }),
    setCronJobs: (cronJobs) => set({ cronJobs }),
    setModels: (models) => set({ models }),
}));

export default useMissionStore;
