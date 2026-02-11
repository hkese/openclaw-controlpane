import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';

/*  ──────────────────────────────────────────────────────
    useTaskDispatch — Send tasks to agents via Gateway
    
    1. Calls gateway.sendToAgent() with a task message
    2. Updates task status to in_progress in Convex
    3. Stores the session key for live tracking
    ────────────────────────────────────────────────────── */

export function useTaskDispatch() {
    const updateTask = useMutation(api.tasks.update);
    const addActivity = useMutation(api.activities.add);
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);

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
            `\nPlease work on this task and report your progress.`
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

    return { dispatchTask, tailSession };
}
