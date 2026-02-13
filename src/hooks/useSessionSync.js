import { useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';
import useMissionStore from '../stores/useMissionStore';

/* ══════════════════════════════════════════════════════════
   useSessionSync — Bridge live gateway sessions → Convex tasks

   Core idea:
   1. Poll sessions.list every 10s for active agent sessions
   2. Listen for real-time chat events from the gateway
   3. Auto-create Convex tasks for sessions without a matching task
   4. Track progress (message count, last content)
   5. Auto-complete when agent signals [DONE]
   ══════════════════════════════════════════════════════════ */

// Signals that mark an agent as finished
const DONE_SIGNALS = ['[DONE]', '[COMPLETE]', '[FINISHED]', '[TASK COMPLETE]', '✅'];

function hasDoneSignal(text) {
    const upper = (text || '').toUpperCase();
    return DONE_SIGNALS.some(s => upper.includes(s));
}

function extractMessageText(msg) {
    if (!msg) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
        return msg.content
            .filter(b => b.type === 'text' && b.text)
            .map(b => b.text)
            .join('\n');
    }
    return JSON.stringify(msg.content || '');
}

/**
 * Determine source from a session key or channel info.
 * Session keys look like: agent:{agentId}:main, whatsapp:{number}:main, etc.
 */
function inferSource(session) {
    const key = session?.sessionKey || session?.key || '';
    const channel = session?.lastChannel || session?.channel || session?.groupChannel || '';
    if (channel.includes('whatsapp') || key.includes('whatsapp')) return 'whatsapp';
    if (channel.includes('telegram') || key.includes('telegram')) return 'telegram';
    if (channel.includes('discord') || key.includes('discord')) return 'discord';
    if (channel.includes('slack') || key.includes('slack')) return 'slack';
    if (key.startsWith('agent:')) return 'gateway';
    return 'gateway';
}

/**
 * Infer channel name from session data.
 * Returns: "whatsapp" | "discord" | "slack" | "telegram" | "web" | undefined
 */
function inferChannel(session) {
    const ch = session?.lastChannel || session?.channel || session?.groupChannel || '';
    if (ch.includes('whatsapp')) return 'whatsapp';
    if (ch.includes('discord')) return 'discord';
    if (ch.includes('slack')) return 'slack';
    if (ch.includes('telegram')) return 'telegram';
    if (ch.includes('web') || ch.includes('browser')) return 'web';
    // Also check the session key for channel hints
    const key = session?.sessionKey || session?.key || '';
    if (key.includes('whatsapp')) return 'whatsapp';
    if (key.includes('discord')) return 'discord';
    if (key.includes('slack')) return 'slack';
    if (key.includes('telegram')) return 'telegram';
    return undefined;
}

/**
 * Extract agent ID from a session key.
 * agent:developer:main → developer
 * agent:main:main → main
 */
function extractAgentFromKey(key) {
    if (!key) return 'main';
    const parts = key.split(':');
    if (parts.length >= 2 && parts[0] === 'agent') {
        return parts[1] || 'main';
    }
    return 'main';
}

/**
 * Build a human-readable task title from session data.
 * Prioritizes actual content over generic labels.
 */
function buildTaskTitle(session, firstMessage) {
    // Use derived title if available
    if (session?.derivedTitle && session.derivedTitle !== 'New Session') {
        return session.derivedTitle;
    }

    // Use first user message as title (best option)
    if (firstMessage) {
        const text = typeof firstMessage === 'string' ? firstMessage : extractMessageText(firstMessage);
        if (text) {
            const clean = text.replace(/[\n\r]+/g, ' ').trim();
            if (clean.length > 0) {
                return clean.length > 80 ? clean.slice(0, 77) + '…' : clean;
            }
        }
    }

    // Fallback — Use agent name (not source), keep it simple
    const agentId = extractAgentFromKey(session?.sessionKey || session?.key);
    return `Task for ${agentId}`;
}

export default function useSessionSync() {
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const subscribeChatEvent = useGatewayStore(s => s.subscribeChatEvent);
    const unsubscribeChatEvent = useGatewayStore(s => s.unsubscribeChatEvent);
    const agents = useMissionStore(s => s.agents);

    const gw = getSelectedGateway();
    const gatewayId = gw?.id;
    const isConnected = gw?.status === 'connected';

    // Convex queries and mutations
    const tasks = useQuery(api.tasks.list, gatewayId ? { gatewayId } : "skip") ?? [];
    const createTask = useMutation(api.tasks.create);
    const updateTask = useMutation(api.tasks.update);

    // Track known session keys to avoid re-processing
    const knownKeysRef = useRef(new Set());
    // Track sessions that are actively streaming (got delta events)
    const activeSessionsRef = useRef(new Map());
    // Debounce timer for session sync
    const syncTimerRef = useRef(null);

    // Build a set of session keys that already have tasks
    const taskSessionKeys = useRef(new Set());
    useEffect(() => {
        taskSessionKeys.current = new Set(
            tasks.filter(t => t.sessionKey).map(t => t.sessionKey)
        );
    }, [tasks]);

    // ─── Handle real-time chat events ───
    const handleChatEvent = useCallback((evt) => {
        const sessionKey = evt?.sessionKey;
        const state = evt?.state; // delta | final
        if (!sessionKey) return;

        // Track active sessions
        if (state === 'delta') {
            if (!activeSessionsRef.current.has(sessionKey)) {
                activeSessionsRef.current.set(sessionKey, {
                    sessionKey,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                    deltaCount: 1,
                    isFinal: false,
                });
            } else {
                const entry = activeSessionsRef.current.get(sessionKey);
                entry.lastSeen = Date.now();
                entry.deltaCount++;
            }
        }

        if (state === 'final') {
            const entry = activeSessionsRef.current.get(sessionKey);
            if (entry) {
                entry.isFinal = true;
                entry.lastSeen = Date.now();
            } else {
                activeSessionsRef.current.set(sessionKey, {
                    sessionKey,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                    deltaCount: 0,
                    isFinal: true,
                });
            }
        }

        // Debounced sync — don't process on every single delta
        if (!syncTimerRef.current) {
            syncTimerRef.current = setTimeout(() => {
                syncTimerRef.current = null;
                processPendingSessions();
            }, 2000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gatewayId]);

    // ─── Process pending sessions — create/update tasks ───
    const processPendingSessions = useCallback(async () => {
        if (!gatewayId || !isConnected || !gw?.connection) return;

        for (const [sessionKey, entry] of activeSessionsRef.current) {
            // Skip if we already have a task for this session
            if (taskSessionKeys.current.has(sessionKey)) {
                // But check if the task needs completion
                if (entry.isFinal) {
                    const task = tasks.find(t => t.sessionKey === sessionKey && t.status === 'in_progress');
                    if (task) {
                        await checkForCompletion(task, sessionKey);
                    }
                }
                continue;
            }

            // Skip sessions we've already processed
            if (knownKeysRef.current.has(sessionKey)) continue;

            // Skip non-agent sessions (e.g., system sessions)
            if (!sessionKey.startsWith('agent:')) continue;

            // Fetch a few messages to understand the session
            try {
                const res = await gw.connection.chatHistory({ sessionKey, limit: 5 });
                const msgs = res?.messages || [];
                if (msgs.length === 0) continue; // No messages yet, skip

                const userMsg = msgs.find(m => m.role === 'user');
                const agentId = extractAgentFromKey(sessionKey);
                const title = buildTaskTitle({ sessionKey, derivedTitle: res?.derivedTitle }, userMsg);
                const source = inferSource({ sessionKey });
                const channel = inferChannel({ sessionKey });

                // Look for spawnedBy in the session entry (populated by full sync)
                const sessionEntry = entry;
                const spawnedBy = sessionEntry?.spawnedBy || undefined;

                knownKeysRef.current.add(sessionKey);

                // Auto-create the task
                console.log('[SessionSync] Auto-creating task:', { sessionKey, title, agentId, source, channel, spawnedBy });
                await createTask({
                    gatewayId,
                    title,
                    description: userMsg ? extractMessageText(userMsg).slice(0, 500) : '',
                    assigneeIds: [agentId],
                    sessionKey,
                    source,
                    channel,
                    spawnedBy,
                });

            } catch (e) {
                console.warn('[SessionSync] Error processing session:', sessionKey, e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gatewayId, isConnected, gw?.connection, tasks, createTask]);

    // ─── Check if agent has finished, and mark task done ───
    const checkForCompletion = useCallback(async (task, sessionKey) => {
        if (!gw?.connection) return;
        try {
            const res = await gw.connection.chatHistory({ sessionKey, limit: 10 });
            const msgs = res?.messages || [];
            const assistantMsgs = msgs.filter(m => m.role === 'assistant');
            if (assistantMsgs.length === 0) return;

            const lastText = extractMessageText(assistantMsgs[assistantMsgs.length - 1]);
            if (hasDoneSignal(lastText)) {
                console.log('[SessionSync] Agent done, completing task:', task.title);
                await updateTask({
                    id: task._id,
                    patch: { status: 'done', completedAt: Date.now() },
                });
            }
        } catch (e) {
            console.warn('[SessionSync] Error checking completion:', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gw?.connection, updateTask]);

    // ─── Periodic full sync — polls sessions.list ───
    useEffect(() => {
        if (!isConnected || !gw?.connection || !gatewayId) return;

        const fullSync = async () => {
            try {
                const sessionsRes = await gw.connection.listSessions({ limit: 50 });
                const sessions = sessionsRes?.sessions || sessionsRes || [];
                if (!Array.isArray(sessions)) return;

                for (const session of sessions) {
                    const key = session?.sessionKey || session?.key;
                    if (!key || !key.startsWith('agent:')) continue;

                    // Skip if we already have a task or already processed
                    if (taskSessionKeys.current.has(key)) continue;
                    if (knownKeysRef.current.has(key)) continue;

                    // Check if this session has recent messages (within last 30 min)
                    const updatedAt = session?.updatedAt || session?.lastActivityAt || 0;
                    const thirtyMinAgo = Date.now() - 30 * 60_000;
                    if (updatedAt < thirtyMinAgo) continue;

                    // Capture session entry data including spawnedBy and channel
                    const entry = session?.entry || session;
                    activeSessionsRef.current.set(key, {
                        sessionKey: key,
                        firstSeen: Date.now(),
                        lastSeen: Date.now(),
                        deltaCount: 1,
                        isFinal: false,
                        // Preserve gateway session metadata
                        spawnedBy: entry?.spawnedBy || session?.spawnedBy,
                        channel: entry?.lastChannel || entry?.channel || entry?.groupChannel || session?.groupChannel,
                    });
                }

                // Process any new sessions found
                if (activeSessionsRef.current.size > 0) {
                    await processPendingSessions();
                }
            } catch (e) {
                console.warn('[SessionSync] Full sync error:', e);
            }
        };

        // Initial sync after a short delay
        const initialTimeout = setTimeout(fullSync, 3000);
        // Then every 10s
        const interval = setInterval(fullSync, 10_000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, gatewayId]);

    // ─── Subscribe to chat events ───
    useEffect(() => {
        subscribeChatEvent(handleChatEvent);
        return () => unsubscribeChatEvent(handleChatEvent);
    }, [subscribeChatEvent, unsubscribeChatEvent, handleChatEvent]);

    // ─── Cleanup on unmount ───
    useEffect(() => {
        return () => {
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            activeSessionsRef.current.clear();
            knownKeysRef.current.clear();
        };
    }, []);

    // Return nothing — this hook is side-effect only
    return null;
}
