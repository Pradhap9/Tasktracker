import React, { useState, useEffect } from 'react';
import { managerAPI } from '../services/api';
import { Users, Clock, ListTodo } from 'lucide-react';

export default function ManagerTeam() {
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTeam();
    }, []);

    const loadTeam = async () => {
        try {
            const res = await managerAPI.getTeam();
            setTeam(res.data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    return (
        <div>
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon blue"><Users size={20} /></div>
                    </div>
                    <div className="stat-card-value">{team.length}</div>
                    <div className="stat-card-label">Total Members</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon green"><ListTodo size={20} /></div>
                    </div>
                    <div className="stat-card-value">{team.filter(m => m.TodayTaskCount > 0).length}</div>
                    <div className="stat-card-label">Submitted Today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon red"><ListTodo size={20} /></div>
                    </div>
                    <div className="stat-card-value">{team.filter(m => m.TodayTaskCount === 0).length}</div>
                    <div className="stat-card-label">Not Submitted</div>
                </div>
            </div>

            <div className="data-section">
                <div className="data-section-header">
                    <h3>Team Members</h3>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Code</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Designation</th>
                            <th>Today Tasks</th>
                            <th>Today Hours</th>
                            <th>Last Login</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {team.map(m => (
                            <tr key={m.UserID}>
                                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.FullName}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.EmployeeCode}</td>
                                <td style={{ fontSize: 12 }}>{m.Email}</td>
                                <td>{m.Department}</td>
                                <td>{m.Designation}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{m.TodayTaskCount}</td>
                                <td style={{ fontFamily: 'var(--font-mono)' }}>{m.TodayHours}h</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                    {m.LastLoginAt ? new Date(m.LastLoginAt).toLocaleString() : 'Never'}
                                </td>
                                <td>
                                    <span className={`badge ${m.TodayTaskCount > 0 ? 'badge-approved' : 'badge-pending'}`}>
                                        {m.TodayTaskCount > 0 ? 'Submitted' : 'Pending'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
