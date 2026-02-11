import { create } from 'zustand';
import { ConvexHttpClient } from 'convex/browser';
import { GatewayConnection } from '../lib/gateway';
import { api } from '../../convex/_generated/api';

// Error constants
export const GW_ERR_DUPLICATE_NAME = 'DUPLICATE_NAME';

// ─── Convex HTTP client for non-React persistence ───
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexHttp = new ConvexHttpClient(convexUrl);

// ─── Convex-based persistence ───
async function loadSavedGateways() {
    try {
        const configs = await convexHttp.query(api.gateway_configs.list);
        return configs.map(c => ({
            id: c.gatewayId,
            name: c.name,
            url: c.url,
            token: c.token,
            selected: c.selected,
        }));
    } catch (e) {
        console.warn('Failed to load gateway configs from Convex, falling back to localStorage', e);
        // Fallback: migrate from localStorage
        try {
            const data = localStorage.getItem('openclaw-controlpane-gateways');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }
}

function saveGateway(gw, selected = false) {
    convexHttp.mutation(api.gateway_configs.upsert, {
        gatewayId: gw.id,
        name: gw.name,
        url: gw.url,
        token: gw.token || '',
        selected,
    }).catch(e => console.warn('Failed to save gateway config', e));
}


function removeGatewayConfig(gatewayId) {
    convexHttp.mutation(api.gateway_configs.remove, { gatewayId })
        .catch(e => console.warn('Failed to remove gateway config', e));
}

function saveSelectedId(id) {
    if (id) {
        convexHttp.mutation(api.gateway_configs.setSelected, { gatewayId: id })
            .catch(e => console.warn('Failed to save selected gateway', e));
    }
}

const useGatewayStore = create((set, get) => ({
    gateways: {},           // id -> { id, name, url, token, connection, status, health, presence, nodes }
    selectedGatewayId: null, // the currently selected gateway — all pages use this
    events: [],             // global event log
    maxEvents: 200,
    _restored: false,       // prevents double-restore

    // ─── Select a gateway for all pages ───
    selectGateway: (id) => {
        set({ selectedGatewayId: id });
        saveSelectedId(id);
    },

    // ─── Computed: get the selected gateway object ───
    getSelectedGateway: () => {
        const state = get();
        const id = state.selectedGatewayId;
        if (!id) return null;
        return state.gateways[id] || null;
    },

    addGateway: (name, url, token, existingId) => {
        // Normalise URL
        url = url.replace(/\/+$/, '');
        const resolvedName = name || url;

        // ── Unique name check ──
        const existing = Object.values(get().gateways);
        const duplicate = existing.find(
            g => g.name.toLowerCase() === resolvedName.toLowerCase() && g.id !== existingId
        );
        if (duplicate) return { error: GW_ERR_DUPLICATE_NAME };

        const id = existingId || `gw-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

        const connection = new GatewayConnection({
            url,
            token,
            name: resolvedName,
            onEvent: (event) => {
                set(state => {
                    const events = [
                        { ...event, gatewayId: connection.instanceId, ts: Date.now() },
                        ...state.events,
                    ].slice(0, state.maxEvents);
                    return { events };
                });
            },
            onStatusChange: (status) => {
                set(state => {
                    const gw = state.gateways[id];
                    if (!gw) return state;
                    const update = {
                        gateways: {
                            ...state.gateways,
                            [id]: { ...gw, status },
                        },
                    };
                    // Auto-select this gateway when it connects and nothing is selected
                    if (status === 'connected' && !state.selectedGatewayId) {
                        update.selectedGatewayId = id;
                        saveSelectedId(id);
                    }
                    return update;
                });
            },
        });

        const gw = {
            id,
            name,
            url,
            token,
            connection,
            status: 'disconnected',
            health: null,
            presence: null,
            nodes: null,
        };

        set(state => {
            const newGateways = { ...state.gateways, [id]: gw };
            // Auto-select if it's the only gateway
            const shouldSelect = !state.selectedGatewayId || Object.keys(state.gateways).length === 0;
            const newSelectedId = shouldSelect ? id : state.selectedGatewayId;
            // Save to Convex DB
            saveGateway(gw, shouldSelect);
            if (shouldSelect) saveSelectedId(id);
            return {
                gateways: newGateways,
                selectedGatewayId: newSelectedId,
            };
        });

        // Auto connect
        connection.connect();

        // Poll health/presence every 10s
        gw._pollInterval = setInterval(async () => {
            if (connection.status === 'connected') {
                const health = await connection.getHealth();
                const presence = await connection.getPresence();
                const nodes = await connection.getNodeList();
                set(state => {
                    const current = state.gateways[id];
                    if (!current) return state;
                    return {
                        gateways: {
                            ...state.gateways,
                            [id]: { ...current, health, presence, nodes },
                        },
                    };
                });
            }
        }, 10000);

        return id;
    },

    // Remove gateway config only (keeps tasks/data in Convex)
    removeGateway: (id) => {
        const state = get();
        const gw = state.gateways[id];
        if (gw) {
            gw.connection.disconnect();
            if (gw._pollInterval) clearInterval(gw._pollInterval);
            const newGateways = { ...state.gateways };
            delete newGateways[id];

            // Remove config from Convex DB (data stays)
            removeGatewayConfig(id);

            // If we just removed the selected gateway, auto-select next
            let newSelected = state.selectedGatewayId;
            if (newSelected === id) {
                const remaining = Object.values(newGateways);
                newSelected = remaining.find(g => g.status === 'connected')?.id
                    || remaining[0]?.id
                    || null;
                saveSelectedId(newSelected);
            }

            set({
                gateways: newGateways,
                selectedGatewayId: newSelected,
                events: state.events.filter(e => e.gatewayId !== gw.connection.instanceId),
            });
        }
    },

    // Remove gateway config AND all associated data (tasks, comments, etc.)
    removeGatewayWithData: async (id) => {
        const state = get();
        const gw = state.gateways[id];
        if (gw) {
            gw.connection.disconnect();
            if (gw._pollInterval) clearInterval(gw._pollInterval);
            const newGateways = { ...state.gateways };
            delete newGateways[id];

            // Remove ALL data from Convex (config + tasks + comments + etc.)
            convexHttp.mutation(api.cleanup.removeAllGatewayData, { gatewayId: id })
                .catch(e => console.warn('Failed to remove gateway data', e));

            let newSelected = state.selectedGatewayId;
            if (newSelected === id) {
                const remaining = Object.values(newGateways);
                newSelected = remaining.find(g => g.status === 'connected')?.id
                    || remaining[0]?.id
                    || null;
                saveSelectedId(newSelected);
            }

            set({
                gateways: newGateways,
                selectedGatewayId: newSelected,
                events: state.events.filter(e => e.gatewayId !== gw.connection.instanceId),
            });
        }
    },

    // Update gateway config (name, url, token) without reconnecting
    updateGateway: (id, patch) => {
        const state = get();
        const gw = state.gateways[id];
        if (!gw) return;

        // Name uniqueness check
        if (patch.name) {
            const dup = Object.values(state.gateways).find(
                g => g.name.toLowerCase() === patch.name.toLowerCase() && g.id !== id
            );
            if (dup) return { error: GW_ERR_DUPLICATE_NAME };
        }

        const updated = { ...gw, ...patch };
        const newGateways = { ...state.gateways, [id]: updated };
        set({ gateways: newGateways });

        // Persist to Convex
        saveGateway(updated, state.selectedGatewayId === id);

        // If URL or token changed, reconnect
        if (patch.url || patch.token) {
            gw.connection.disconnect();
            if (gw._pollInterval) clearInterval(gw._pollInterval);
            // Re-add with new config
            get().removeGateway(id);
            get().addGateway(updated.name, updated.url, updated.token, id);
        }
    },

    // Disconnect but keep in list (unlike removeGateway which deletes)
    disconnectGateway: (id) => {
        const state = get();
        const gw = state.gateways[id];
        if (gw) {
            gw.connection.disconnect();
            if (gw._pollInterval) clearInterval(gw._pollInterval);
            set(state => ({
                gateways: {
                    ...state.gateways,
                    [id]: { ...state.gateways[id], status: 'disconnected', health: null, presence: null, nodes: null },
                },
            }));
        }
    },

    reconnectGateway: (id) => {
        const gw = get().gateways[id];
        if (gw) {
            gw.connection.reconnectAttempts = 0;
            gw.connection.connect();
        }
    },

    // Restore saved gateways on app init (only once)
    restoreGateways: async () => {
        if (get()._restored) return;
        set({ _restored: true });

        const saved = await loadSavedGateways();
        if (!saved || saved.length === 0) return;

        let selectedId = null;
        saved.forEach(cfg => {
            get().addGateway(cfg.name, cfg.url, cfg.token, cfg.id);
            if (cfg.selected) selectedId = cfg.id;
        });

        if (selectedId) {
            set({ selectedGatewayId: selectedId });
        }

        // Clean up old localStorage data if migration happened
        try {
            localStorage.removeItem('openclaw-controlpane-gateways');
            localStorage.removeItem('openclaw-controlpane-selected-gw');
        } catch { }
    },

    getGatewayArray: () => {
        return Object.values(get().gateways);
    },

    getStats: () => {
        const gws = Object.values(get().gateways);
        const connected = gws.filter(g => g.status === 'connected').length;
        const total = gws.length;
        let sessions = 0;
        let channels = 0;
        gws.forEach(g => {
            if (g.status === 'connected' && g.health) {
                if (g.health.sessions) {
                    sessions += typeof g.health.sessions === 'number' ? g.health.sessions : Object.keys(g.health.sessions).length;
                }
                if (g.health.channels) {
                    channels += typeof g.health.channels === 'number' ? g.health.channels : Object.keys(g.health.channels).length;
                }
            }
        });
        return { connected, total, sessions, channels };
    },
}));

export default useGatewayStore;
