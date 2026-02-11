import { useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';

/*  ──────────────────────────────────────────────────────
    useTaskDispatch — Send tasks to agents via Gateway
    
    v2.5: Added session watcher for auto-completion detection
    1. Calls gateway.sendToAgent() with a task message
    2. Updates task status to in_progress in Convex
    3. Stores the session key for live tracking
    4. Watches session for completion → auto-move to review
    ────────────────────────────────────────────────────── */

// Completion signals that indicate an agent is done
const DONE_SIGNALS = ['[DONE]', '[COMPLETE]', '[FINISHED]', '[TASK COMPLETE]', '✅'];

export function useTaskDispatch() {
    const updateTask = useMutation(api.tasks.update);
    const addActivity = useMutation(api.activities.add);
    const addComment = useMutation(api.comments.create);
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);

    // Track active watchers to avoid duplicates
    const watchersRef = useRef(new Map());

    const dispatchTask = async (task) => {
        const gw = getSelectedGateway();
        if (!gw?.connection || gw.status !== 'connected') {
            throw new Error('No connected gateway');
        }

        const agentId = task.assigneeIds?.[0];
        if (!agentId) {
            throw new Error('No agent assigned to this task');
        }

        // Compose the task message for the agent
        const taskMessage = [
            `[TASK] ${task.title}`,
            task.description ? `\nDescription: ${task.description}` : '',
            `\nPlease work on this task and report your progress. When finished, include [DONE] in your final message.`
        ].join('');

        try {
            // Send to agent via Gateway
            const res = await gw.connection.sendToAgent(taskMessage, {
                agentId,
            });

            // Extract session key from response if available
            const sessionKey = res?.sessionKey || res?.session?.key || `task-${task._id}-${Date.now()}`;

            // Update task to in_progress with session key
            await updateTask({
                id: task._id,
                patch: {
                    status: 'in_progress',
                    sessionKey,
                },
            });

            // Log activity
            await addActivity({
                gatewayId: gw.id,
                type: 'task_dispatched',
                agentName: agentId,
                message: `Started working on: ${task.title}`,
            });

            // Start watching the session for completion
            startWatcher(task._id, sessionKey, gw, agentId, task.title);

            return { sessionKey, success: true };
        } catch (err) {
            console.error('Failed to dispatch task:', err);

            // Still move to in_progress even if send partially fails
            await updateTask({
                id: task._id,
                patch: { status: 'in_progress' },
            });

            await addActivity({
                gatewayId: gw.id,
                type: 'task_dispatch_error',
                agentName: agentId,
                message: `Error dispatching "${task.title}": ${err.message}`,
            });

            return { success: false, error: err.message };
        }
    };

    const startWatcher = (taskId, sessionKey, gw, agentId, taskTitle) => {
        // Don't duplicate watchers
        if (watchersRef.current.has(taskId)) return;

        let lastMsgCount = 0;
        let idleSince = null;

        const interval = setInterval(async () => {
            try {
                const gwNow = getSelectedGateway();
                if (!gwNow?.connection || gwNow.status !== 'connected') return;

                const res = await gwNow.connection.tailChat({ key: sessionKey, limit: 30 });
                const msgs = res?.messages || res || [];
                if (!Array.isArray(msgs) || msgs.length === 0) return;

                const assistantMsgs = msgs.filter(m => m.role === 'assistant');
                if (assistantMsgs.length === 0) return;

                const lastMsg = assistantMsgs[assistantMsgs.length - 1];
                const lastContent = typeof lastMsg.content === 'string'
                    ? lastMsg.content
                    : JSON.stringify(lastMsg.content || '');

                // Check for explicit done signals
                const hasDoneSignal = DONE_SIGNALS.some(s =>
                    lastContent.toUpperCase().includes(s)
                );

                // Check for idle detection (no new messages for 30s after agent replied)
                if (msgs.length > lastMsgCount) {
                    lastMsgCount = msgs.length;
                    idleSince = Date.now();
                }
                const isIdle = idleSince && (Date.now() - idleSince > 30000) && assistantMsgs.length > 0;

                if (hasDoneSignal || isIdle) {
                    // Auto-move to review
                    await updateTask({
                        id: taskId,
                        patch: { status: 'review' },
                    });

                    // Add agent's final output as a comment
                    const summary = lastContent.slice(0, 500);
                    await addComment({
                        gatewayId: gwNow.id,
                        taskId,
                        content: `🤖 Agent completed:\n${summary}`,
                        fromAgent: agentId,
                    });

                    await addActivity({
                        gatewayId: gwNow.id,
                        type: 'task_review',
                        agentName: agentId,
                        message: `Completed "${taskTitle}" → moved to review`,
                    });

                    // Stop watching
                    clearInterval(interval);
                    watchersRef.current.delete(taskId);
                }
            } catch (err) {
                console.warn('[TaskWatcher] Error:', err);
            }
        }, 5000); // Poll every 5s

        watchersRef.current.set(taskId, interval);
    };

    // Resume watchers for tasks that are in_progress (e.g. after page refresh)
    const resumeWatchers = useCallback((tasks) => {
        const gw = getSelectedGateway();
        if (!gw?.connection || gw.status !== 'connected') return;

        tasks.forEach(task => {
            if (task.status === 'in_progress' && task.sessionKey && !watchersRef.current.has(task._id)) {
                const agentId = task.assigneeIds?.[0] || 'unknown';
                startWatcher(task._id, task.sessionKey, gw, agentId, task.title);
            }
        });
    }, [getSelectedGateway]);

    const tailSession = async (sessionKey) => {
        const gw = getSelectedGateway();
        if (!gw?.connection || gw.status !== 'connected') return null;

        try {
            const res = await gw.connection.tailChat({ key: sessionKey, limit: 20 });
            return res?.messages || res || [];
        } catch {
            return [];
        }
    };

    // Stop all watchers on unmount
    const stopAllWatchers = useCallback(() => {
        watchersRef.current.forEach(interval => clearInterval(interval));
        watchersRef.current.clear();
    }, []);

    return { dispatchTask, tailSession, resumeWatchers, stopAllWatchers };
}
