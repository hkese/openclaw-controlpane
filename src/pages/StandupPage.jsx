import { motion } from 'framer-motion';
import { Newspaper, CheckCircle, Clock, AlertTriangle, Eye, Activity } from 'lucide-react';
import useMissionStore from '../stores/useMissionStore';
import { getAgentEmoji } from '../components/AgentCard';

/* ──────────────────────────────────────────────────────
   StandupPage — Daily standup summary view
   Aggregates: completed, in progress, blocked, review
   ────────────────────────────────────────────────────── */

export default function StandupPage() {
    const tasks = useMissionStore(s => s.tasks);
    const activities = useMissionStore(s => s.activities);
    const agents = useMissionStore(s => s.agents);
    const comments = useMissionStore(s => s.comments);

    // Today boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const tomorrowMs = todayMs + 86400000;

    const todayActivities = activities.filter(a => a.ts >= todayMs && a.ts < tomorrowMs);
    const todayComments = comments.filter(c => c.ts >= todayMs && c.ts < tomorrowMs);

    const completed = tasks.filter(t => t.status === 'done');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const blocked = tasks.filter(t => t.status === 'blocked');
    const needsReview = tasks.filter(t => t.status === 'review');
    const assigned = tasks.filter(t => t.status === 'assigned');
    const inbox = tasks.filter(t => t.status === 'inbox');

    // Per-agent activity summary
    const agentActivity = {};
    todayActivities.forEach(a => {
        if (!agentActivity[a.agentName]) agentActivity[a.agentName] = [];
        agentActivity[a.agentName].push(a);
    });

    const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return (
        <motion.div className="page standup-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header">
                <div className="page-title">
                    <Newspaper size={22} />
                    <h1>Daily Standup</h1>
                </div>
                <span className="standup-date">{dateStr}</span>
            </div>

            <div className="standup-grid">
                {/* Completed */}
                <StandupSection icon={<CheckCircle size={18} />} title="Completed" color="#22c55e" items={completed} />

                {/* In Progress */}
                <StandupSection icon={<Clock size={18} />} title="In Progress" color="#f59e0b" items={inProgress} />

                {/* Blocked */}
                <StandupSection icon={<AlertTriangle size={18} />} title="Blocked" color="#ef4444" items={blocked} />

                {/* Needs Review */}
                <StandupSection icon={<Eye size={18} />} title="Needs Review" color="#a855f7" items={needsReview} />
            </div>

            {/* Summary Stats */}
            <div className="standup-stats">
                <div className="stat-card">
                    <span className="stat-value">{tasks.length}</span>
                    <span className="stat-label">Total Tasks</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{todayActivities.length}</span>
                    <span className="stat-label">Today's Activities</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{todayComments.length}</span>
                    <span className="stat-label">Comments Today</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{inbox.length}</span>
                    <span className="stat-label">Inbox</span>
                </div>
            </div>

            {/* Agent Activity */}
            {Object.keys(agentActivity).length > 0 && (
                <div className="standup-agent-activity">
                    <h3><Activity size={16} /> Agent Activity Today</h3>
                    {Object.entries(agentActivity).map(([name, acts]) => (
                        <div key={name} className="agent-activity-row">
                            <span className="agent-activity-name">
                                {getAgentEmoji(name)} {name}
                            </span>
                            <ul>
                                {acts.slice(0, 5).map(a => (
                                    <li key={a.id}>{a.message}</li>
                                ))}
                                {acts.length > 5 && <li className="muted">...and {acts.length - 5} more</li>}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {/* Recent Activity Feed */}
            <div className="standup-feed">
                <h3>Recent Activity</h3>
                {activities.slice(0, 20).map(a => (
                    <div key={a.id} className="feed-item">
                        <span className="feed-time">{new Date(a.ts).toLocaleTimeString()}</span>
                        <span className="feed-agent">{a.agentName}</span>
                        <span className="feed-message">{a.message}</span>
                    </div>
                ))}
                {activities.length === 0 && <p className="muted">No activity recorded yet</p>}
            </div>
        </motion.div>
    );
}

function StandupSection({ icon, title, color, items }) {
    return (
        <div className="standup-section" style={{ '--section-color': color }}>
            <div className="standup-section-header">
                {icon}
                <h3>{title}</h3>
                <span className="standup-count">{items.length}</span>
            </div>
            <div className="standup-section-body">
                {items.length === 0 && <p className="muted">None</p>}
                {items.map(t => (
                    <div key={t.id} className="standup-task">
                        <span>{t.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
