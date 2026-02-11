import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Server } from 'lucide-react';
import useGatewayStore from '../stores/useGatewayStore';

export default function AddGatewayModal({ isOpen, onClose }) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const addGateway = useGatewayStore(s => s.addGateway);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        addGateway(
            name.trim() || url.trim(),
            url.trim(),
            token.trim() || undefined
        );
        setName('');
        setUrl('');
        setToken('');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="modal"
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                            <div>
                                <div className="modal-title">🦞 添加 Gateway</div>
                                <div className="modal-subtitle">連接一個新嘅 OpenClaw Gateway 實例</div>
                            </div>
                            <button className="btn-icon" onClick={onClose}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">名稱</label>
                                <input
                                    className="form-input"
                                    placeholder="例如：主伺服器、Home Gateway"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <div className="form-hint">可選，唔填嘅話會用 URL 做名</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Gateway 地址</label>
                                <input
                                    className="form-input"
                                    placeholder="localhost:18789"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    required
                                />
                                <div className="form-hint">Gateway 嘅 WebSocket 地址（例如 localhost:18789 或 ws://192.168.1.100:18789）</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Auth Token</label>
                                <input
                                    className="form-input"
                                    type="password"
                                    placeholder="gateway auth token (可選)"
                                    value={token}
                                    onChange={e => setToken(e.target.value)}
                                />
                                <div className="form-hint">如果 Gateway 設咗 auth token 就需要填</div>
                            </div>

                            <div className="btn-group">
                                <button type="button" className="btn btn-secondary" onClick={onClose}>
                                    取消
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    <Plus size={16} />
                                    連接 Gateway
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
