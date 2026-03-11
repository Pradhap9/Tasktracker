import React, { useState, useEffect } from 'react';
import { managerAPI, taskAPI } from '../services/api';
import { Users, CheckCircle, AlertTriangle, Clock, ListTodo } from 'lucide-react';

function parseTime(t) { if(!t)return null; var p=t.split(':'); return {hours:parseInt(p[0],10),minutes:parseInt(p[1],10)}; }
function formatTime12(t) { if(!t)return''; var p=parseTime(t); if(!p)return t; var h=p.hours,m=p.minutes,per=h>=12?'PM':'AM',dh=h>12?h-12:h===0?12:h; return dh+':'+String(m).padStart(2,'0')+' '+per; }
function getWindowStatus(c) { var now=new Date(),cm=now.getHours()*60+now.getMinutes(),s=parseTime(c.TASK_WINDOW_START),e=parseTime(c.TASK_WINDOW_END),sm=s?s.hours*60+s.minutes:540,em=e?e.hours*60+e.minutes:660; if(cm>=sm&&cm<em)return'open'; if(cm>=em)return'closed'; return'before'; }

export default function ManagerDashboard() {
    const [stats, setStats] = useState(null);
    const [escalations, setEscalations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ TASK_WINDOW_START:'09:00', TASK_WINDOW_END:'11:00', ESCALATION_TRIGGER_TIME:'11:01' });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [statsRes, escRes, configRes] = await Promise.all([
                managerAPI.getDashboardStats(),
                managerAPI.getEscalations(),
                taskAPI.getSubmissionWindow()
            ]);
            setStats(statsRes.data.data);
            setEscalations((escRes.data.data || []).filter(e => !e.IsDismissed).slice(0, 10));
            if (configRes.data.data) setConfig(prev => ({ ...prev, ...configRes.data.data }));
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleDismiss = async (id) => {
        try { await managerAPI.dismissEscalation(id); loadData(); } catch (e) { console.error(e); }
    };

    var windowStatus = getWindowStatus(config);
    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    return (
        <div>
            <div style={{
                background: windowStatus==='open' ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.06))' : windowStatus==='closed' ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))' : 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.06))',
                border: '1px solid '+(windowStatus==='open'?'rgba(16,185,129,0.15)':windowStatus==='closed'?'rgba(245,158,11,0.15)':'rgba(59,130,246,0.15)'),
                borderRadius:'var(--radius-lg)', padding:'16px 24px', marginBottom:20,
                display:'flex', alignItems:'center', justifyContent:'space-between'
            }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Clock size={18} style={{ color: windowStatus==='open'?'var(--accent-green)':windowStatus==='closed'?'var(--accent-amber)':'var(--accent-blue)' }} />
                    <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
                            {windowStatus==='open' && 'Submission Window Open'}
                            {windowStatus==='closed' && 'Submission Window Closed'}
                            {windowStatus==='before' && 'Submission Window Not Yet Open'}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                            Window: {formatTime12(config.TASK_WINDOW_START)} - {formatTime12(config.TASK_WINDOW_END)} | Escalation at: {formatTime12(config.ESCALATION_TRIGGER_TIME)}
                        </div>
                    </div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>
                    {stats?.MembersSubmittedToday || 0} / {stats?.TotalTeamMembers || 0} submitted
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon blue"><Users size={20} /></div></div><div className="stat-card-value">{stats?.TotalTeamMembers || 0}</div><div className="stat-card-label">Team Members</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon green"><CheckCircle size={20} /></div></div><div className="stat-card-value">{stats?.MembersSubmittedToday || 0}</div><div className="stat-card-label">Submitted Today</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon amber"><ListTodo size={20} /></div></div><div className="stat-card-value">{stats?.PendingApprovals || 0}</div><div className="stat-card-label">Pending Approvals</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon red"><AlertTriangle size={20} /></div></div><div className="stat-card-value">{stats?.TodayEscalations || 0}</div><div className="stat-card-label">Today's Escalations</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon purple"><Clock size={20} /></div></div><div className="stat-card-value">{stats?.TotalTeamHoursToday || 0}h</div><div className="stat-card-label">Team Hours Today</div></div>
            </div>

            <div className="data-section">
                <div className="data-section-header"><h3>Escalation Alerts</h3></div>
                {escalations.length === 0 ? (
                    <div className="empty-state" style={{ padding:40 }}><CheckCircle size={40} /><p>No active escalations. All team members are on track.</p></div>
                ) : (
                    <table className="data-table">
                        <thead><tr><th>Employee</th><th>Code</th><th>Date</th><th>Message</th><th>Action</th></tr></thead>
                        <tbody>
                            {escalations.map(e => (
                                <tr key={e.EscalationID}>
                                    <td style={{ color:'var(--text-primary)', fontWeight:500 }}>{e.UserName}</td>
                                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{e.EmployeeCode}</td>
                                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{new Date(e.EscalationDate).toLocaleDateString()}</td>
                                    <td style={{ fontSize:12, maxWidth:300 }}>{e.Message}</td>
                                    <td><button className="btn btn-outline btn-xs" onClick={() => handleDismiss(e.EscalationID)}>Dismiss</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}