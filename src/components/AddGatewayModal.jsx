import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Server, Save } from 'lucide-react';
import useGatewayStore, { GW_ERR_DUPLICATE_NAME } from '../stores/useGatewayStore';

/**
 * AddGatewayModal — Add or Edit gateway config.
 * Props:
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - editGateway: { id, name, url, token } | null — if set, modal is in edit mode
 */
export default function AddGatewayModal({ isOpen, onClose, editGateway = null }) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const addGateway = useGatewayStore(s => s.addGateway);
    const updateGateway = useGatewayStore(s => s.updateGateway);

    const isEdit = !!editGateway;

    // Pre-fill when opening in edit mode
    useEffect(() => {
        if (editGateway) {
            setName(editGateway.name || '');
            setUrl(editGateway.url || '');
            setToken(editGateway.token || '');
        } else {
            setName('');
            setUrl('');
            setToken('');
        }
        setError('');
    }, [editGateway, isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        setError('');

        if (isEdit) {
            // Update existing gateway
            const result = updateGateway(editGateway.id, {
                name: name.trim() || url.trim(),
                url: url.trim(),
                token: token.trim() || undefined,
            });
            if (result?.error === GW_ERR_DUPLICATE_NAME) {
                setError('已有相同名稱嘅 Gateway，請用另一個名');
                return;
            }
        } else {
            // Add new gateway
            const result = addGateway(
                name.trim() || url.trim(),
                url.trim(),
                token.trim() || undefined
            );
            if (result?.error === GW_ERR_DUPLICATE_NAME) {
                setError('已有相同名稱嘅 Gateway，請用另一個名');
                return;
            }
        }

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
                                <div className="modal-title">
                                    {isEdit ? '✏️ 編輯 Gateway' : '🦞 添加 Gateway'}
                                </div>
                                <div className="modal-subtitle">
                                    {isEdit ? '修改 Gateway 嘅連接設定' : '連接一個新嘅 OpenClaw Gateway 實例'}
                                </div>
                            </div>
                            <button className="btn-icon" onClick={onClose}>
                                <X size={16} />
                            </button>
                        </div>

                        {error && (
                            <div className="form-error" style={{
                                background: 'rgba(239,68,68,0.12)',
                                color: '#f87171',
                                padding: '8px 12px',
                                borderRadius: 8,
                                fontSize: 13,
                                marginBottom: 16,
                                border: '1px solid rgba(239,68,68,0.2)',
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

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
                                    placeholder="ws://127.0.0.1:18888"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    required
                                />
                                <div className="form-hint">Gateway 嘅 WebSocket 地址（例如 ws://127.0.0.1:18888）</div>
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
                                    {isEdit ? (
                                        <><Save size={16} /> 儲存修改</>
                                    ) : (
                                        <><Plus size={16} /> 連接 Gateway</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
