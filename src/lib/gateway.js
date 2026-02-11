/**
 * OpenClaw Gateway WebSocket 連接管理器
 * 實現 OpenClaw Gateway 嘅 WS 協議
 *
 * Handshake flow:
 * 1. Client opens WebSocket
 * 2. Gateway sends: { type: "event", event: "connect.challenge", payload: { nonce, ts } }
 * 3. Client sends: { type: "req", method: "connect", params: { ... auth: { token }, device: { nonce } } }
 * 4. Gateway responds: { type: "res", ok: true, payload: { type: "hello-ok", ... } }
 */

let idCounter = 0;
function nextId() {
    return `cp-${++idCounter}-${Date.now()}`;
}

export class GatewayConnection {
    constructor({ url, token, name, onEvent, onStatusChange }) {
        this.url = url;
        this.token = token;
        this.name = name || url;
        this.onEvent = onEvent || (() => { });
        this.onStatusChange = onStatusChange || (() => { });
        this.ws = null;
        this.status = 'disconnected'; // disconnected | connecting | connected | error
        this.helloPayload = null;
        this.pendingRequests = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectTimer = null;
        this.healthData = null;
        this.presenceData = null;
        this.instanceId = `controlpane-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.deviceId = `controlpane-device-${Math.random().toString(36).slice(2, 10)}`;
        this._challengeReceived = false;
        this._challengeNonce = null;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this._setStatus('connecting');
        this._challengeReceived = false;
        this._challengeNonce = null;

        const wsUrl = this.url.startsWith('ws') ? this.url : `ws://${this.url}`;
        try {
            this.ws = new WebSocket(wsUrl);
        } catch (err) {
            this._setStatus('error');
            return;
        }

        this.ws.onopen = () => {
            // Don't send connect yet — wait for connect.challenge event from Gateway
            // Set a timeout in case challenge never comes (fallback for simpler gateways)
            this._challengeTimeout = setTimeout(() => {
                if (!this._challengeReceived) {
                    // No challenge received — try sending connect directly
                    this._sendConnect(null);
                }
            }, 3000);
        };

        this.ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                this._handleMessage(msg);
            } catch (e) {
                console.error('[GatewayConnection] Failed to parse message:', e);
            }
        };

        this.ws.onclose = (evt) => {
            clearTimeout(this._challengeTimeout);
            if (this.status === 'connected') {
                this._setStatus('disconnected');
                this._scheduleReconnect();
            } else {
                this._setStatus('error');
                this._scheduleReconnect();
            }
        };

        this.ws.onerror = () => {
            // onclose will fire after this
        };
    }

    disconnect() {
        clearTimeout(this.reconnectTimer);
        clearTimeout(this._challengeTimeout);
        this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._setStatus('disconnected');
        this.helloPayload = null;
        this.healthData = null;
        this.presenceData = null;
    }

    async request(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('Not connected'));
                return;
            }
            const id = nextId();
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request ${method} timed out`));
            }, 15000);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            this.ws.send(JSON.stringify({
                type: 'req',
                id,
                method,
                params,
            }));
        });
    }

    async getHealth() {
        try {
            const res = await this.request('health');
            this.healthData = res;
            return res;
        } catch (e) {
            return null;
        }
    }

    async getStatus() {
        try {
            return await this.request('status');
        } catch (e) {
            return null;
        }
    }

    async getPresence() {
        try {
            const res = await this.request('system-presence');
            this.presenceData = res;
            return res;
        } catch (e) {
            return null;
        }
    }

    async getNodeList() {
        try {
            return await this.request('node.list');
        } catch (e) {
            return null;
        }
    }

    // ─── Private ───

    _sendConnect(nonce) {
        const connectMsg = {
            type: 'req',
            id: nextId(),
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
                    instanceId: this.instanceId,
                },
                role: 'operator',
                scopes: ['operator.read', 'operator.write'],
                caps: [],
                commands: [],
                permissions: {},
                ...(this.token ? { auth: { token: this.token } } : {}),
                locale: navigator.language || 'en-US',
                userAgent: 'openclaw-controlpane/1.0.0',
                // Note: device identity omitted for local connections
                // (publicKey, signature, signedAt are required if device is sent,
                //  but device itself is optional — local/loopback can skip it)
            },
        };

        const id = connectMsg.id;
        this.pendingRequests.set(id, {
            resolve: (payload) => {
                this.helloPayload = payload;
                this._setStatus('connected');
                this.reconnectAttempts = 0;
                // Fetch initial data
                this.getHealth();
                this.getPresence();
            },
            reject: (err) => {
                console.error('[GatewayConnection] Connect rejected:', err);
                this._setStatus('error');
            },
            timeout: setTimeout(() => {
                this.pendingRequests.delete(id);
                this._setStatus('error');
            }, 10000),
        });

        this.ws.send(JSON.stringify(connectMsg));
    }

    _handleMessage(msg) {
        if (msg.type === 'res') {
            const pending = this.pendingRequests.get(msg.id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(msg.id);
                if (msg.ok) {
                    pending.resolve(msg.payload);
                } else {
                    pending.reject(new Error(msg.error?.message || msg.error?.code || 'Request failed'));
                }
            }
        } else if (msg.type === 'event') {
            // Handle connect.challenge before handshake
            if (msg.event === 'connect.challenge' && !this._challengeReceived) {
                this._challengeReceived = true;
                this._challengeNonce = msg.payload?.nonce || null;
                clearTimeout(this._challengeTimeout);
                // Now send the connect request with the nonce
                this._sendConnect(this._challengeNonce);
                return;
            }
            this._handleEvent(msg);
        }
    }

    _handleEvent(msg) {
        // Update internal state for presence events
        if (msg.event === 'presence' && msg.payload) {
            this.presenceData = msg.payload;
        }

        this.onEvent({
            gatewayId: this.instanceId,
            gatewayName: this.name,
            event: msg.event,
            payload: msg.payload,
            seq: msg.seq,
            timestamp: Date.now(),
        });
    }

    _setStatus(status) {
        this.status = status;
        this.onStatusChange(status, this);
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
}
