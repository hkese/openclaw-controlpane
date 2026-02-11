import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RefreshCw, Play, Pause, Plus, Trash2, Bot, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';

/* ──────────────────────────────────────────────────────
   CronPage — Cron job management & heartbeat timeline
   ────────────────────────────────────────────────────── */

export default function CronPage() {
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const cronJobs = useMissionStore(s => s.cronJobs);
    const setCronJobs = useMissionStore(s => s.setCronJobs);
    const [loading, setLoading] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [runs, setRuns] = useState([]);

    const connectedGw = getSelectedGateway();

    const fetchCrons = useCallback(async () => {
        if (!connectedGw) return;
        setLoading(true);
        try {
            const res = await connectedGw.connection.listCron({ includeDisabled: true });
            if (res?.jobs) setCronJobs(res.jobs);
            else if (Array.isArray(res)) setCronJobs(res);
        } catch (e) {
            console.error('Failed to fetch crons:', e);
        } finally {
            setLoading(false);
        }
    }, [connectedGw]);

    useEffect(() => { fetchCrons(); }, [fetchCrons]);
    useEffect(() => {
        const timer = setInterval(fetchCrons, 30000);
        return () => clearInterval(timer);
    }, [fetchCrons]);

    const handleRun = async (job) => {
        if (!connectedGw) return;
        try {
            await connectedGw.connection.runCron(job.id, 'force');
            setTimeout(fetchCrons, 2000);
        } catch (e) {
            console.error('Failed to run cron:', e);
        }
    };

    const handleToggle = async (job) => {
        if (!connectedGw) return;
        try {
            await connectedGw.connection.updateCron({ id: job.id, patch: { enabled: !job.enabled } });
            fetchCrons();
        } catch (e) {
            console.error('Failed to toggle cron:', e);
        }
    };

    const loadRuns = async (job) => {
        if (!connectedGw) return;
        setSelectedJob(job);
        try {
            const res = await connectedGw.connection.getCronRuns(job.id, 20);
            if (res?.runs) setRuns(res.runs);
            else if (Array.isArray(res)) setRuns(res);
            else setRuns([]);
        } catch {
            setRuns([]);
        }
    };

    const getScheduleText = (job) => {
        if (!job.schedule) return '—';
        if (job.schedule.kind === 'cron') return job.schedule.expr;
        if (job.schedule.kind === 'every') return `every ${Math.round(job.schedule.everyMs / 60000)}m`;
        if (job.schedule.kind === 'at') return `at ${job.schedule.at}`;
        return '—';
    };

    return (
        <motion.div className="page cron-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header">
                <div className="page-title">
                    <Clock size={22} />
                    <h1>Cron Jobs & Heartbeats</h1>
                    <span className="badge">{cronJobs.length}</span>
                </div>
                <div className="page-actions">
                    <button className="btn-icon" onClick={fetchCrons} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {!connectedGw && (
                <div className="empty-state">
                    <Bot size={48} /><h3>No Gateway Connected</h3>
                </div>
            )}

            {/* Heartbeat Timeline */}
            {cronJobs.length > 0 && (
                <div className="heartbeat-timeline">
                    <h3 className="section-title">Heartbeat Timeline</h3>
                    <div className="timeline-bar">
                        {cronJobs.filter(j => j.enabled).map(job => {
                            const lastRun = job.state?.lastRunAtMs;
                            const nextRun = job.state?.nextRunAtMs;
                            const isRunning = !!job.state?.runningAtMs;
                            const lastStatus = job.state?.lastStatus;
                            return (
                                <div key={job.id} className="timeline-entry" onClick={() => loadRuns(job)}>
                                    <div className={`timeline-dot ${isRunning ? 'running' : lastStatus || 'idle'}`} />
                                    <div className="timeline-info">
                                        <span className="timeline-name">{job.name}</span>
                                        <span className="timeline-schedule">{getScheduleText(job)}</span>
                                    </div>
                                    {lastRun && <span className="timeline-time">{formatRelative(lastRun)}</span>}
                                    {nextRun && <span className="timeline-next">Next: {formatRelative(nextRun)}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Cron Jobs List */}
            <div className="cron-list">
                {cronJobs.map(job => (
                    <motion.div
                        key={job.id}
                        className={`cron-item ${!job.enabled ? 'disabled' : ''}`}
                        whileHover={{ x: 2 }}
                    >
                        <div className="cron-item-left">
                            <div className={`cron-status-icon ${job.state?.lastStatus || 'idle'}`}>
                                {job.state?.lastStatus === 'ok' && <CheckCircle size={16} />}
                                {job.state?.lastStatus === 'error' && <XCircle size={16} />}
                                {!job.state?.lastStatus && <Clock size={16} />}
                            </div>
                            <div className="cron-details">
                                <span className="cron-name">{job.name}</span>
                                {job.description && <span className="cron-desc">{job.description}</span>}
                                <div className="cron-meta">
                                    <span>{getScheduleText(job)}</span>
                                    <span>Target: {job.sessionTarget}</span>
                                    {job.agentId && <span>Agent: {job.agentId}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="cron-item-actions">
                            <button className="btn-icon" onClick={() => handleRun(job)} title="Run now">
                                <Play size={14} />
                            </button>
                            <button className="btn-icon" onClick={() => handleToggle(job)} title={job.enabled ? 'Disable' : 'Enable'}>
                                {job.enabled ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button className="btn-icon" onClick={() => loadRuns(job)} title="View runs">
                                <Clock size={14} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Run History Drawer */}
            <AnimatePresence>
                {selectedJob && (
                    <motion.div className="drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedJob(null)}>
                        <motion.div
                            className="drawer"
                            initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="drawer-header">
                                <h2>Run History: {selectedJob.name}</h2>
                                <button className="btn-icon" onClick={() => setSelectedJob(null)}>&times;</button>
                            </div>
                            <div className="drawer-body">
                                {runs.length === 0 && <p className="muted">No run history available</p>}
                                {runs.map((run, i) => (
                                    <div key={i} className={`run-entry ${run.status || ''}`}>
                                        <div className="run-status-icon">
                                            {run.status === 'ok' && <CheckCircle size={14} />}
                                            {run.status === 'error' && <XCircle size={14} />}
                                            {run.status === 'skipped' && <AlertTriangle size={14} />}
                                        </div>
                                        <div className="run-details">
                                            <span>{new Date(run.ts || run.runAtMs).toLocaleString()}</span>
                                            {run.durationMs && <span>{run.durationMs}ms</span>}
                                            {run.summary && <span className="run-summary">{run.summary}</span>}
                                            {run.error && <span className="run-error">{run.error}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function formatRelative(ms) {
    if (!ms) return '—';
    const diff = Date.now() - ms;
    if (diff < 0) {
        const future = -diff;
        if (future < 60000) return `in ${Math.floor(future / 1000)}s`;
        if (future < 3600000) return `in ${Math.floor(future / 60000)}m`;
        return `in ${Math.floor(future / 3600000)}h`;
    }
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ms).toLocaleDateString();
}
