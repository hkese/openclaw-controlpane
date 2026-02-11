# 🦞 OpenClaw ControlPane

> Mission Control for your OpenClaw Gateway — monitor agents, channels, sessions, and nodes in real time.

## Features

- **Gateway Dashboard** — Connect to any OpenClaw Gateway via WebSocket
- **Real-time Monitoring** — Live health events, presence updates, and activity feed
- **Channel Status** — View WhatsApp, Discord, and other channel states
- **Node Management** — See paired devices and their connection status
- **Session Overview** — Track active agent sessions
- **Dark Theme** — Premium Mission Control aesthetic with glassmorphism
- **Persistent Config** — Gateway configurations saved to localStorage

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Connect to a Gateway

1. Click **「+ 添加 Gateway」**
2. Enter your Gateway address (e.g. `127.0.0.1:18888`)
3. Enter your Gateway auth token
4. Click **「連接 Gateway」**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React + Vite |
| State | Zustand |
| Animation | Framer Motion |
| Icons | Lucide React |
| Protocol | OpenClaw Gateway WS v3 |

## Project Structure

```
src/
├── lib/gateway.js          # WebSocket connection manager
├── stores/useGatewayStore.js # Zustand state management
├── components/
│   ├── Header.jsx          # Top bar with global metrics
│   ├── Sidebar.jsx         # Navigation + gateway list
│   ├── GatewayCard.jsx     # Gateway overview card
│   ├── EventFeed.jsx       # Real-time event stream
│   ├── StatusBadge.jsx     # Status indicator
│   └── AddGatewayModal.jsx # Add gateway form
├── pages/
│   ├── Dashboard.jsx       # Main dashboard
│   └── GatewayDetail.jsx   # Gateway detail view
├── App.jsx                 # Root component + routing
├── main.jsx                # Entry point
└── index.css               # Design system + dark theme
```

## License

MIT
