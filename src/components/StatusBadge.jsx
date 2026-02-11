export default function StatusBadge({ status }) {
    const map = {
        connected: { label: 'ONLINE', cls: 'online' },
        connecting: { label: '連接中', cls: 'connecting' },
        configured: { label: '已設定', cls: 'connecting' },
        offline: { label: 'OFFLINE', cls: 'offline' },
        disconnected: { label: 'OFFLINE', cls: 'offline' },
        error: { label: '錯誤', cls: 'offline' },
        working: { label: 'WORKING', cls: 'working' },
    };

    const { label, cls } = map[status] || map.disconnected;

    return (
        <span className={`status-badge ${cls}`}>
            <span className="badge-dot" />
            {label}
        </span>
    );
}
