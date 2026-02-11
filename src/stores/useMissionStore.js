import { create } from 'zustand';

/*  ──────────────────────────────────────────────────────
    useMissionStore — Live Gateway data (not persisted)
    
    Persistent data (tasks, comments, docs, activities,
    notifications) is now in Convex. This store only holds
    live data fetched from the Gateway WebSocket.
    ────────────────────────────────────────────────────── */

const useMissionStore = create(() => ({
    // Live data fetched from Gateway (not persisted)
    agents: [],          // from agents.list
    sessions: [],        // from sessions.list
    cronJobs: [],        // from cron.list
    models: [],          // from models.list

    // ─── Gateway data setters ───
    setAgents: (agents) => useMissionStore.setState({ agents }),
    setSessions: (sessions) => useMissionStore.setState({ sessions }),
    setCronJobs: (cronJobs) => useMissionStore.setState({ cronJobs }),
    setModels: (models) => useMissionStore.setState({ models }),
}));

export default useMissionStore;
