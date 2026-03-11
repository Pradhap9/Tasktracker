import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Settings, Save, Clock, Bell } from 'lucide-react';

export default function AdminConfig() {
    const [config, setConfig] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});

    useEffect(() => {
        adminAPI.getEscalationConfig()
            .then(res => setConfig(res.data.data || []))
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, []);

    const handleUpdate = async (key, value) => {
        setSaving(s => ({ ...s, [key]: true }));
        try {
            await adminAPI.updateEscalationConfig(key, { value });
            alert(`${key} updated successfully.`);
        } catch (e) {
            alert('Failed to update configuration.');
        } finally {
            setSaving(s => ({ ...s, [key]: false }));
        }
    };

    const updateValue = (key, value) => {
        setConfig(c => c.map(item => item.ConfigKey === key ? { ...item, ConfigValue: value } : item));
    };

    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    const getIcon = (key) => {
        if (key.includes('TIME') || key.includes('WINDOW')) return <Clock size={18} />;
        if (key.includes('SOUND')) return <Bell size={18} />;
        return <Settings size={18} />;
    };

    return (
        <div>
            <div style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.05))',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 28px',
                marginBottom: 28
            }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Escalation Configuration</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Configure the task submission window and escalation rules. Changes take effect immediately.
                </p>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
                {config.map(item => (
                    <div key={item.ConfigKey} className="data-section" style={{ marginBottom: 0 }}>
                        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                            <div className="stat-card-icon amber" style={{ flexShrink: 0 }}>
                                {getIcon(item.ConfigKey)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
                                    {item.ConfigKey.replace(/_/g, ' ')}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {item.Description}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                {item.ConfigValue === 'true' || item.ConfigValue === 'false' ? (
                                    <select
                                        className="form-select"
                                        style={{ width: 120 }}
                                        value={item.ConfigValue}
                                        onChange={e => updateValue(item.ConfigKey, e.target.value)}
                                    >
                                        <option value="true">Enabled</option>
                                        <option value="false">Disabled</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ width: 120 }}
                                        value={item.ConfigValue}
                                        onChange={e => updateValue(item.ConfigKey, e.target.value)}
                                    />
                                )}
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleUpdate(item.ConfigKey, item.ConfigValue)}
                                    disabled={saving[item.ConfigKey]}
                                >
                                    <Save size={14} />
                                    {saving[item.ConfigKey] ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
