#!/usr/bin/env node

/**
 * OpenClaw Multi-Agent Orchestration Test
 * ────────────────────────────────────────
 * 
 * Creates a "big goal" and decomposes it into 3 sub-tasks, one per agent.
 * Each agent works independently, and the orchestrator monitors all 3
 * for completion before declaring the goal done.
 * 
 * Runs endlessly, retrying on failure.
 * 
 * Usage: node test/orchestration-test.mjs
 */

import WebSocket from 'ws';

// ─── Configuration ───

const GATEWAY_URL = 'ws://localhost:18888';
const GATEWAY_TOKEN = '5957a3b676892d31dc0501abe2889a10a6bbe6a73ad58b1c';

// Agents to use for sub-tasks (picked from the 10 configured agents)
const TASK_AGENTS = ['developer', 'designer', 'content-writer'];

const POLL_INTERVAL_MS = 8000;     // Check for completion every 8s
const TASK_TIMEOUT_MS = 180_000;   // 3 minute timeout per task
const DONE_SIGNALS = ['[DONE]', '[COMPLETE]', '[FINISHED]', '[TASK COMPLETE]', '✅'];

// ─── Logging ───

const log = (tag, ...args) => console.log(`[${new Date().toLocaleTimeString()}] [${tag}]`, ...args);
const err = (tag, ...args) => console.error(`[${new Date().toLocaleTimeString()}] [${tag}] ❌`, ...args);

// ─── WebSocket Gateway Client ───

let idCounter = 0;
function nextId() { return `test-${++idCounter}-${Date.now()}`; }

class TestGatewayClient {
    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.ws = null;
        this.pendingRequests = new Map();
        this.connected = false;
        this._challengeReceived = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            log('GW', `Connecting to ${this.url}...`);
            this.ws = new WebSocket(this.url);

            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 15000);

            this.ws.on('open', () => {
                log('GW', 'WebSocket open, waiting for challenge...');
                // Set fallback in case no challenge
                setTimeout(() => {
                    if (!this._challengeReceived) {
                        log('GW', 'No challenge received, sending connect directly...');
                        this._sendConnect(null, resolve, reject);
                    }
                }, 3000);
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());

                    // Handle challenge
                    if (msg.type === 'event' && msg.event === 'connect.challenge' && !this._challengeReceived) {
                        this._challengeReceived = true;
                        clearTimeout(timeout);
                        log('GW', 'Challenge received, sending connect...');
                        this._sendConnect(msg.payload?.nonce, resolve, reject);
                        return;
                    }

                    // Handle responses
                    if (msg.type === 'res') {
                        const pending = this.pendingRequests.get(msg.id);
                        if (pending) {
                            clearTimeout(pending.timeout);
                            this.pendingRequests.delete(msg.id);
                            if (msg.ok) {
                                pending.resolve(msg.payload);
                            } else {
                                pending.reject(new Error(msg.error?.message || 'Request failed'));
                            }
                        }
                    }

                    // Handle events
                    if (msg.type === 'event' && msg.event !== 'connect.challenge') {
                        // Log interesting events
                        if (msg.event === 'chat') {
                            const sk = msg.payload?.sessionKey || '';
                            const state = msg.payload?.state || '';
                            log('EVENT', `chat event: sessionKey=${sk} state=${state}`);
                        }
                    }
                } catch (e) {
                    // ignore parse errors
                }
            });

            this.ws.on('close', () => {
                log('GW', 'WebSocket closed');
                this.connected = false;
            });

            this.ws.on('error', (e) => {
                err('GW', 'WebSocket error:', e.message);
                clearTimeout(timeout);
                reject(e);
            });
        });
    }

    _sendConnect(nonce, resolve, reject) {
        const id = nextId();
        // Must match the gateway's client validation schema exactly
        // client.id MUST be 'gateway-client' (validated as constant)
        const msg = {
            type: 'req',
            id,
            method: 'connect',
            params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                    id: 'gateway-client',
                    displayName: 'OpenClaw ControlPane',
                    version: '1.0.0',
                    platform: 'web',
                    mode: 'ui',
                    instanceId: `test-${Date.now()}`,
                },
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: this.token },
                locale: 'en-US',
                userAgent: 'openclaw-controlpane/1.0.0',
            },
        };

        this.pendingRequests.set(id, {
            resolve: (payload) => {
                log('GW', '✅ Connected!', payload?.type || '');
                this.connected = true;
                resolve(payload);
            },
            reject: (error) => {
                err('GW', 'Connect rejected:', error);
                reject(error);
            },
            timeout: setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Connect timeout'));
            }, 10000),
        });

        this.ws.send(JSON.stringify(msg));
    }

    async request(method, params = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected');
        }
        return new Promise((resolve, reject) => {
            const id = nextId();
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${method} timed out`));
            }, 30000);

            this.pendingRequests.set(id, { resolve, reject, timeout });
            this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
        });
    }

    // Gateway API methods
    async listAgents() { return this.request('agents.list'); }
    async listSessions(params = {}) { return this.request('sessions.list', { includeDerivedTitles: true, includeLastMessage: true, limit: 50, ...params }); }
    async chatHistory(sessionKey, limit = 50) { return this.request('chat.history', { sessionKey, limit }); }
    async sendToAgent(message, params = {}) {
        const idempotencyKey = `orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const agentId = params.agentId || 'main';
        const sessionKey = params.sessionKey || `agent:${agentId}:main`;
        // IMPORTANT: Do NOT send agentId explicitly — the gateway validates it against
        // cfg.agents.list which may not include custom agents like 'developer'.
        // Instead, send only sessionKey — the gateway resolves the agent from it.
        const { agentId: _discardedAgentId, ...restParams } = params;
        return this.request('agent', { message, idempotencyKey, sessionKey, ...restParams });
    }
    async agentWait(runId, timeoutMs = 30000) { return this.request('agent.wait', { runId, timeoutMs }); }
    async getHealth() { return this.request('health'); }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// ─── Message Text Extraction ───

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

function hasDoneSignal(text) {
    const upper = (text || '').toUpperCase();
    return DONE_SIGNALS.some(s => upper.includes(s));
}

// ─── The Big Goal ───

function createBigGoal() {
    return {
        title: 'Build a Landing Page for "NexusAI" — a Fictional AI Startup',
        description: 'Create a modern, professional landing page for NexusAI, an AI-powered business automation platform.',
        subtasks: [
            {
                agentId: 'developer',
                title: 'Build the HTML/CSS structure for the NexusAI landing page',
                description: `Create the technical implementation for a NexusAI landing page. Include:
- A hero section with headline "AI That Works For You" and a CTA button
- A features section showing 3 key features (Smart Automation, Real-time Analytics, Team Collaboration)
- A pricing section with 3 tiers (Starter $29/mo, Pro $79/mo, Enterprise custom)
- A footer with links
Use modern CSS with dark mode, gradients, and smooth animations. Output the HTML and CSS code.
When finished, include [DONE] in your response.`,
            },
            {
                agentId: 'designer',
                title: 'Design the visual identity and branding for NexusAI',
                description: `Create the visual branding guide for NexusAI. Define:
- Color palette (primary, secondary, accent colors with hex codes)
- Typography recommendations (heading font, body font)
- Logo concept description (describe what the logo should look like)
- Visual style guide (rounded corners vs sharp, shadow styles, spacing)
- UI component styles for buttons, cards, badges
Write this as a brief creative brief / brand guide document.
When finished, include [DONE] in your response.`,
            },
            {
                agentId: 'content-writer',
                title: 'Write all marketing copy for the NexusAI landing page',
                description: `Write compelling marketing copy for NexusAI's landing page. Include:
- Hero headline and subheadline
- 3 feature descriptions (Smart Automation, Real-time Analytics, Team Collaboration) — each with a catchy title and 2-3 sentence description
- Pricing tier descriptions (Starter, Pro, Enterprise) — each with a bullet list of features
- Social proof / testimonial quotes (create 2-3 fictional customer quotes)
- CTA button text and surrounding copy
- Footer tagline
Write in a confident, modern tech startup tone.
When finished, include [DONE] in your response.`,
            },
        ],
    };
}

// ─── Orchestration Engine ───

async function runOrchestration(client) {
    const goal = createBigGoal();
    const runId = Date.now();

    log('ORCH', '━'.repeat(60));
    log('ORCH', `🎯 BIG GOAL: ${goal.title}`);
    log('ORCH', `📋 ${goal.subtasks.length} sub-tasks to dispatch`);
    log('ORCH', '━'.repeat(60));

    // Step 1: List available agents
    log('ORCH', 'Listing available agents...');
    try {
        const agentsRes = await client.listAgents();
        const agents = agentsRes?.agents || agentsRes || [];
        log('ORCH', `Found ${Array.isArray(agents) ? agents.length : 0} agents:`,
            Array.isArray(agents) ? agents.map(a => a.agentId || a.id || 'unknown').join(', ') : JSON.stringify(agents).slice(0, 200));
    } catch (e) {
        log('ORCH', 'agents.list not available, proceeding with known agents...');
    }

    // Step 2: Dispatch all subtasks
    const dispatched = [];

    for (const subtask of goal.subtasks) {
        const sessionKey = `agent:${subtask.agentId}:main`;
        log('ORCH', `\n📤 Dispatching to [${subtask.agentId}]: "${subtask.title}"`);
        log('ORCH', `   Session key: ${sessionKey}`);

        try {
            const res = await client.sendToAgent(subtask.description, {
                agentId: subtask.agentId,
                sessionKey,
            });
            log('ORCH', `   ✅ Accepted! runId: ${res?.runId}`);
            dispatched.push({
                ...subtask,
                sessionKey,
                runId: res?.runId,
                status: 'in_progress',
                startedAt: Date.now(),
                lastContent: '',
                msgCount: 0,
            });
        } catch (e) {
            err('ORCH', `   Failed to dispatch to ${subtask.agentId}:`, e.message);
            dispatched.push({
                ...subtask,
                sessionKey,
                status: 'error',
                error: e.message,
            });
        }

        // Small delay between dispatches to avoid overwhelming
        await sleep(1000);
    }

    const inProgress = dispatched.filter(d => d.status === 'in_progress');
    log('ORCH', `\n━━━ ${inProgress.length}/${goal.subtasks.length} tasks dispatched successfully ━━━\n`);

    if (inProgress.length === 0) {
        err('ORCH', 'No tasks dispatched successfully. Will retry...');
        return false;
    }

    // Step 3: Monitor all tasks for completion
    log('ORCH', '🔄 Starting completion monitoring...\n');

    const completed = new Set();
    const errors = new Set();
    let pollCount = 0;

    while (completed.size + errors.size < inProgress.length) {
        pollCount++;
        await sleep(POLL_INTERVAL_MS);

        for (const task of inProgress) {
            if (completed.has(task.agentId) || errors.has(task.agentId)) continue;

            // Check timeout
            if (Date.now() - task.startedAt > TASK_TIMEOUT_MS) {
                log('ORCH', `⏰ [${task.agentId}] TIMEOUT after ${Math.round(TASK_TIMEOUT_MS / 1000)}s`);
                errors.add(task.agentId);
                continue;
            }

            try {
                const res = await client.chatHistory(task.sessionKey, 30);
                const msgs = res?.messages || [];

                if (!Array.isArray(msgs) || msgs.length === 0) {
                    if (pollCount % 3 === 0) {
                        log('ORCH', `   [${task.agentId}] No messages yet (poll #${pollCount})`);
                    }
                    continue;
                }

                const assistantMsgs = msgs.filter(m => m.role === 'assistant');
                const newMsgCount = msgs.length;

                if (newMsgCount > task.msgCount) {
                    task.msgCount = newMsgCount;
                    const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
                    if (lastAssistant) {
                        const text = extractMessageText(lastAssistant);
                        task.lastContent = text;
                        const preview = text.slice(0, 120).replace(/\n/g, ' ');
                        log('ORCH', `   [${task.agentId}] 📝 ${assistantMsgs.length} assistant msgs, latest: "${preview}..."`);

                        // Check for done signal
                        if (hasDoneSignal(text)) {
                            log('ORCH', `   [${task.agentId}] ✅ DONE! Found completion signal`);
                            completed.add(task.agentId);
                            task.status = 'done';
                            task.completedAt = Date.now();
                        }
                    }
                }
            } catch (e) {
                if (pollCount % 5 === 0) {
                    err('ORCH', `   [${task.agentId}] Error polling:`, e.message);
                }
            }
        }

        // Progress report
        const progress = `${completed.size}/${inProgress.length} done, ${errors.size} errors`;
        if (pollCount % 3 === 0) {
            log('ORCH', `\n📊 Progress: ${progress} (poll #${pollCount})\n`);
        }
    }

    // Step 4: Report results
    log('ORCH', '\n' + '═'.repeat(60));
    log('ORCH', '🏁 ORCHESTRATION COMPLETE');
    log('ORCH', '═'.repeat(60));

    for (const task of dispatched) {
        const emoji = task.status === 'done' ? '✅' : task.status === 'error' ? '❌' : '⏳';
        const duration = task.completedAt
            ? `${Math.round((task.completedAt - task.startedAt) / 1000)}s`
            : 'n/a';
        log('ORCH', `  ${emoji} [${task.agentId}] ${task.title} — ${task.status} (${duration})`);
        if (task.lastContent) {
            const summary = task.lastContent.slice(0, 200).replace(/\n/g, ' ');
            log('ORCH', `     └─ "${summary}..."`);
        }
    }

    const allDone = completed.size === inProgress.length;
    if (allDone) {
        log('ORCH', `\n🎉 BIG GOAL ACHIEVED! All ${inProgress.length} sub-tasks completed successfully!`);
    } else {
        log('ORCH', `\n⚠️  ${completed.size}/${inProgress.length} tasks completed. ${errors.size} failed.`);
    }
    log('ORCH', '═'.repeat(60) + '\n');

    return allDone;
}

// ─── Utility ───

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Loop ───

async function main() {
    log('MAIN', '🚀 Multi-Agent Orchestration Test');
    log('MAIN', `Gateway: ${GATEWAY_URL}`);
    log('MAIN', `Agents: ${TASK_AGENTS.join(', ')}`);
    log('MAIN', '');

    let attempt = 0;

    while (true) {
        attempt++;
        log('MAIN', `\n${'█'.repeat(60)}`);
        log('MAIN', `  ATTEMPT #${attempt}`);
        log('MAIN', `${'█'.repeat(60)}\n`);

        let client = null;
        try {
            // Connect to gateway
            client = new TestGatewayClient(GATEWAY_URL, GATEWAY_TOKEN);
            await client.connect();

            // Health check
            const health = await client.getHealth();
            log('MAIN', 'Gateway health:', health?.status || 'unknown');

            // Run orchestration
            const success = await runOrchestration(client);

            if (success) {
                log('MAIN', '\n🎊🎊🎊 SUCCESS! Multi-agent orchestration completed! 🎊🎊🎊');
                log('MAIN', 'Waiting 30s before next run...\n');
                client.disconnect();
                await sleep(30000);
            } else {
                log('MAIN', '\n❌ Orchestration did not fully complete. Retrying in 15s...\n');
                client.disconnect();
                await sleep(15000);
            }
        } catch (e) {
            err('MAIN', 'Fatal error:', e.message);
            err('MAIN', e.stack);
            if (client) client.disconnect();
            log('MAIN', 'Retrying in 10s...\n');
            await sleep(10000);
        }
    }
}

main().catch(e => {
    err('MAIN', 'Unhandled error:', e);
    process.exit(1);
});
