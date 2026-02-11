import { create } from 'zustand';
import { GatewayConnection } from '../lib/gateway';

// Load saved gateways from localStorage
function loadSavedGateways() {
    try {
        const data = localStorage.getItem('openclaw-controlpane-gateways');
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveGateways(gateways) {
    const serializable = Object.values(gateways).map(g => ({
        id: g.id,
        name: g.name,
        url: g.url,
        token: g.token,
    }));
    localStorage.setItem('openclaw-controlpane-gateways', JSON.stringify(serializable));
}

const useGatewayStore = create((set, get) => ({
    gateways: {},   // id -> { id, name, url, token, connection, status, health, presence, nodes }
    events: [],     // global event log
    maxEvents: 200,

    addGateway: (name, url, token) => {
        const id = `gw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const connection = new GatewayConnection({
            url,
            token,
            name,
            onEvent: (event) => {
                set(state => ({
                    events: [event, ...state.events].slice(0, state.maxEvents),
                }));
                // Also update gateway-specific data
                if (event.event === 'presence') {
                    set(state => {
                        const gw = state.gateways[id];
                        if (!gw) return state;
                        return {
                            gateways: {
                                ...state.gateways,
                                [id]: { ...gw, presence: event.payload },
                            },
                        };
                    });
                }
            },
            onStatusChange: (status) => {
                set(state => {
                    const gw = state.gateways[id];
                    if (!gw) return state;
                    return {
                        gateways: {
                            ...state.gateways,
                            [id]: { ...gw, status },
                        },
                    };
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
            saveGateways(newGateways);
            return { gateways: newGateways };
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

    removeGateway: (id) => {
        const state = get();
        const gw = state.gateways[id];
        if (gw) {
            gw.connection.disconnect();
            if (gw._pollInterval) clearInterval(gw._pollInterval);
            const newGateways = { ...state.gateways };
            delete newGateways[id];
            saveGateways(newGateways);
            set({
                gateways: newGateways,
                events: state.events.filter(e => e.gatewayId !== gw.connection.instanceId),
            });
        }
    },

    reconnectGateway: (id) => {
        const gw = get().gateways[id];
        if (gw) {
            gw.connection.reconnectAttempts = 0;
            gw.connection.connect();
        }
    },

    // Restore saved gateways on app init
    restoreGateways: () => {
        const saved = loadSavedGateways();
        saved.forEach(({ name, url, token }) => {
            get().addGateway(name, url, token);
        });
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
            if (g.health) {
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
