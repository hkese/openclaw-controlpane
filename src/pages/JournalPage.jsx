import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Trash2, Tag, Smile, Clock } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';

const MOODS = ['🔥', '✅', '🐛', '💡', '⚠️', '🎯', '📝'];

function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString('zh-HK', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function JournalPage() {
    const selectedGatewayId = useGatewayStore(s => s.selectedGatewayId);
    const gateways = useGatewayStore(s => s.gateways);
    const selectedGw = selectedGatewayId ? gateways[selectedGatewayId] : null;
    const isConnected = selectedGw?.status === 'connected';

    const entries = useQuery(
        api.journal.list,
        selectedGatewayId ? { gatewayId: selectedGatewayId } : 'skip'
    ) ?? [];
    const addEntry = useMutation(api.journal.add);
    const removeEntry = useMutation(api.journal.remove);

    const [content, setContent] = useState('');
    const [selectedMood, setSelectedMood] = useState('📝');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setTagInput('');
        }
    };

    const handleSubmit = async () => {
        if (!content.trim() || !selectedGatewayId) return;
        await addEntry({
            gatewayId: selectedGatewayId,
            content: content.trim(),
            mood: selectedMood,
            tags: tags.length > 0 ? tags : undefined,
        });
        setContent('');
        setTags([]);
        setSelectedMood('📝');
    };

    return (
        <div className="page-content" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="page-header">
                <div className="page-title">
                    <BookOpen size={22} />
                    <span>Journal</span>
                    <span className="counter-badge">{entries.length}</span>
                </div>
            </div>

            {!selectedGatewayId && (
                <div className="empty-state">
                    <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <div>Select a gateway to view its journal</div>
                </div>
            )}

            {selectedGatewayId && (
                <>
                    {/* Entry Form */}
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ marginBottom: 24 }}
                    >
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="What's happening with this project? Log a thought, bug, milestone..."
                            className="input"
                            rows={3}
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                minHeight: 80,
                                fontFamily: 'inherit',
                                marginBottom: 12,
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
                            }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Mood picker */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {MOODS.map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setSelectedMood(m)}
                                        style={{
                                            background: selectedMood === m ? 'var(--accent-green-dim)' : 'transparent',
                                            border: selectedMood === m ? '1px solid var(--accent-green)' : '1px solid transparent',
                                            borderRadius: 6,
                                            padding: '4px 6px',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            {/* Tags */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                                {tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="channel-badge"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setTags(tags.filter(t => t !== tag))}
                                    >
                                        {tag} ×
                                    </span>
                                ))}
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    placeholder="Add tag..."
                                    className="input"
                                    style={{ width: 90, padding: '4px 8px', fontSize: '0.75rem' }}
                                />
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={!content.trim()}
                                style={{ gap: 6 }}
                            >
                                <Plus size={14} /> Log Entry
                            </button>
                        </div>
                    </motion.div>

                    {/* Entries timeline */}
                    {entries.length === 0 ? (
                        <div className="empty-state">
                            <BookOpen size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
                            <div>No journal entries yet</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Start logging your thoughts, bugs, milestones...
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <AnimatePresence>
                                {entries.map((entry, i) => (
                                    <motion.div
                                        key={entry._id}
                                        className="card"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: i * 0.03 }}
                                        style={{ position: 'relative' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{
                                                fontSize: '1.4rem',
                                                lineHeight: 1,
                                                minWidth: 28,
                                                textAlign: 'center',
                                                paddingTop: 2,
                                            }}>
                                                {entry.mood || '📝'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '0.88rem',
                                                    lineHeight: 1.6,
                                                    color: 'var(--text-primary)',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {entry.content}
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    marginTop: 8,
                                                    fontSize: '0.72rem',
                                                    color: 'var(--text-muted)',
                                                }}>
                                                    <Clock size={11} />
                                                    {timeAgo(entry.createdAt)}
                                                    {entry.tags?.map(tag => (
                                                        <span key={tag} className="channel-badge" style={{ fontSize: '0.65rem' }}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                className="btn-icon"
                                                style={{ opacity: 0.3, width: 24, height: 24 }}
                                                onClick={() => removeEntry({ id: entry._id })}
                                                title="Delete entry"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
