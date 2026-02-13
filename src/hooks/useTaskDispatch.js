import { useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';

/*  ──────────────────────────────────────────────────────
    useTaskDispatch — Send tasks to agents via Gateway
    
    v3.0: Fixed to use correct OpenClaw gateway API:
    - chat.history instead of non-existent chat.tail
    - Deterministic session key: agent:{agentId}:main
    - agent.wait for run completion detection
    - Proper content array parsing for messages
    ────────────────────────────────────────────────────── */

// Completion signals that indicate an agent is done
const DONE_SIGNALS = ['[DONE]', '[COMPLETE]', '[FINISHED]', '[TASK COMPLETE]', '✅'];

/**
 * Extract text from a chat.history message content field.
 * OpenClaw messages use content: [{ type: 'text', text: '...' }] arrays.
 */
function extractMessageText(msg) {
    if (!msg) return '';

    // Direct string content
    if (typeof msg.content === 'string') return msg.content;

    // Content array format: [{ type: 'text', text: '...' }, ...]
    if (Array.isArray(msg.content)) {
        return msg.content
            .filter(block => block.type === 'text' && block.text)
            .map(block => block.text)
            .join('\n');
    }

    // Fallback
    return JSON.stringify(msg.content || '');
}

/**
 * Construct the canonical session key for an agent.
 * Format: agent:{agentId}:main
 */
function buildSessionKey(agentId) {
    const normalized = (agentId || 'main').trim().toLowerCase();
    return `agent:${normalized}:main`;
}

export function useTaskDispatch() {
    const updateTask = useMutation(api.tasks.update);
    const addActivity = useMutation(api.activities.add);
    const addComment = useMutation(api.comments.create);
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);

    // Track active watchers to avoid duplicates
    const watchersRef = useRef(new Map());

    /**
     * Dispatch a task to an agent via the gateway.
     * 
     * Key insights from OpenClaw source analysis:
     * 1. gateway.sendToAgent() returns { runId, status: 'accepted' } — NO sessionKey
     * 2. Session key is deterministic: agent:{agentId}:main
     * 3. Use chat.history (not chat.tail) to read messages
     * 4. Use agent.wait to detect completion
     */
    const dispatchTask = async (task) => {
        const gw = getSelectedGateway();
        if (!gw?.connection || gw.status !== 'connected') {
            throw new Error('No connected gateway');
        }

        const agentId = task.assigneeIds?.[0];
        if (!agentId) {
            throw new Error('No agent assigned to this task');
        }

        // Construct the deterministic session key
        const sessionKey = buildSessionKey(agentId);
        console.log('[TaskDispatch] Using session key:', sessionKey, 'for agent:', agentId);

        // Compose the task message for the agent
        const taskMessage = [
            `[TASK] ${task.title}`,
            task.description ? `\nDescription: ${task.description}` : '',
            `\nPlease work on this task and report your progress. When finished, include [DONE] in your final message.`
        ].join('');

        try {
            // Send to agent via Gateway — includes sessionKey in the request
            const res = await gw.connection.sendToAgent(taskMessage, {
                agentId,
                sessionKey,
            });

            console.log('[TaskDispatch] sendToAgent response:', JSON.stringify(res, null, 2));

            const runId = res?.runId;

            // Update task to in_progress with the deterministic session key
            await updateTask({
                id: task._id,
                patch: {
                    status: 'in_progress',
                    sessionKey,
                    runId: runId || null,
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
            startWatcher(task._id, sessionKey, gw, agentId, task.title, runId);

            return { sessionKey, runId, success: true };
        } catch (err) {
            console.error('Failed to dispatch task:', err);

            // Still move to in_progress even if send partially fails
            await updateTask({
                id: task._id,
                patch: {
                    status: 'in_progress',
                    sessionKey,
                },
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

    /**
     * Watch a session for completion signals.
     * Uses chat.history polling + optional agent.wait for robust detection.
     */
    const startWatcher = (taskId, sessionKey, gw, agentId, taskTitle, runId) => {
        // Don't duplicate watchers
        if (watchersRef.current.has(taskId)) return;
        if (!sessionKey) return;

        let lastMsgCount = 0;
        let idleSince = null;

        // If we have a runId, also start an agent.wait in the background
        if (runId && gw?.connection?.agentWait) {
            gw.connection.agentWait(runId, 120_000).then(result => {
                console.log('[TaskWatcher] agent.wait result:', result);
                // The watcher interval will pick up the completion via chat.history
            }).catch(() => { });
        }

        const interval = setInterval(async () => {
            try {
                const gwNow = getSelectedGateway();
                if (!gwNow?.connection || gwNow.status !== 'connected') return;

                // Use chat.history (the correct API) instead of non-existent chat.tail
                const res = await gwNow.connection.chatHistory({ sessionKey, limit: 30 });
                const msgs = res?.messages || [];
                if (!Array.isArray(msgs) || msgs.length === 0) return;

                const assistantMsgs = msgs.filter(m => m.role === 'assistant');
                if (assistantMsgs.length === 0) return;

                const lastMsg = assistantMsgs[assistantMsgs.length - 1];
                const lastContent = extractMessageText(lastMsg);

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
                startWatcher(task._id, task.sessionKey, gw, agentId, task.title, task.runId);
            }
        });
    }, [getSelectedGateway]);

    /**
     * Get session messages using chat.history.
     * Returns normalized messages with text content extracted.
     */
    const tailSession = async (sessionKey, agentId) => {
        const gw = getSelectedGateway();
        if (!gw?.connection || gw.status !== 'connected') return null;

        try {
            // Use chat.history — the correct OpenClaw API
            const res = await gw.connection.chatHistory({ sessionKey, limit: 50 });
            const msgs = res?.messages || [];

            if (Array.isArray(msgs) && msgs.length > 0) {
                // Normalize messages — extract text from content arrays
                return msgs.map(msg => ({
                    ...msg,
                    content: extractMessageText(msg),
                }));
            }

            // If no messages and we have an agentId, try the canonical key
            if (agentId) {
                const canonicalKey = buildSessionKey(agentId);
                if (canonicalKey !== sessionKey) {
                    console.log('[tailSession] Trying canonical key:', canonicalKey);
                    const res2 = await gw.connection.chatHistory({ sessionKey: canonicalKey, limit: 50 });
                    const msgs2 = res2?.messages || [];
                    if (Array.isArray(msgs2) && msgs2.length > 0) {
                        return {
                            messages: msgs2.map(msg => ({
                                ...msg,
                                content: extractMessageText(msg),
                            })),
                            correctedKey: canonicalKey,
                        };
                    }
                }
            }

            return [];
        } catch (err) {
            console.warn('[tailSession] Error:', err);
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
