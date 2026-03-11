import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskAPI } from '../services/api';
import { ListTodo, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

function parseTime(t) { if(!t)return null; var p=t.split(':'); return {hours:parseInt(p[0],10),minutes:parseInt(p[1],10)}; }
function formatTime12(t) { if(!t)return''; var p=parseTime(t); if(!p)return t; var h=p.hours,m=p.minutes,per=h>=12?'PM':'AM',dh=h>12?h-12:h===0?12:h; return dh+':'+String(m).padStart(2,'0')+' '+per; }
function getWindowStatus(c) { var now=new Date(),cm=now.getHours()*60+now.getMinutes(),s=parseTime(c.TASK_WINDOW_START),e=parseTime(c.TASK_WINDOW_END),sm=s?s.hours*60+s.minutes:540,em=e?e.hours*60+e.minutes:660; if(cm>=sm&&cm<em)return'open'; if(cm>=em)return'closed'; return'before'; }

export default function UserDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [recentTasks, setRecentTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ TASK_WINDOW_START:'09:00', TASK_WINDOW_END:'11:00', ESCALATION_TRIGGER_TIME:'11:01' });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [statsRes, tasksRes, configRes] = await Promise.all([
                taskAPI.getDashboardStats(),
                taskAPI.getAll({ limit: 5 }),
                taskAPI.getSubmissionWindow()
            ]);
            setStats(statsRes.data.data);
            setRecentTasks(tasksRes.data.data || []);
            if (configRes.data.data) setConfig(prev => ({ ...prev, ...configRes.data.data }));
        } catch (e) { console.error('Dashboard load error:', e); } finally { setLoading(false); }
    };

    var hours = new Date().getHours();
    var greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
    var windowStatus = getWindowStatus(config);

    if (loading) return <div className="empty-state"><p>Loading dashboard...</p></div>;

    return (
        <div>
            <div style={{ background:'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.08))', border:'1px solid rgba(59,130,246,0.15)', borderRadius:'var(--radius-lg)', padding:'28px 32px', marginBottom:28 }}>
                <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>{greeting}, {user?.fullName?.split(' ')[0]}</h2>
                <p style={{ color:'var(--text-muted)', fontSize:14 }}>
                    {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                    {user?.managerName && ' | Reporting to: '+user.managerName}
                </p>

                {windowStatus === 'open' && (
                    <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:8, background:'var(--accent-green-bg)', color:'var(--accent-green)', padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:600, border:'1px solid rgba(16,185,129,0.2)' }}>
                        <Clock size={14} /> Task submission window is open ({formatTime12(config.TASK_WINDOW_START)} - {formatTime12(config.TASK_WINDOW_END)})
                    </div>
                )}
                {windowStatus === 'closed' && stats?.TodayTasks === 0 && (
                    <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:8, background:'var(--accent-red-bg)', color:'var(--accent-red)', padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:600, border:'1px solid rgba(239,68,68,0.2)' }}>
                        <AlertTriangle size={14} /> Submission window closed at {formatTime12(config.TASK_WINDOW_END)}. No tasks submitted today.
                    </div>
                )}
                {windowStatus === 'closed' && stats?.TodayTasks > 0 && (
                    <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:8, background:'var(--accent-green-bg)', color:'var(--accent-green)', padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:600, border:'1px solid rgba(16,185,129,0.2)' }}>
                        <CheckCircle size={14} /> Tasks submitted. Window closed at {formatTime12(config.TASK_WINDOW_END)}.
                    </div>
                )}
                {windowStatus === 'before' && (
                    <div style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:8, background:'rgba(59,130,246,0.08)', color:'var(--accent-blue)', padding:'6px 14px', borderRadius:100, fontSize:12, fontWeight:600, border:'1px solid rgba(59,130,246,0.15)' }}>
                        <Clock size={14} /> Task submission window opens at {formatTime12(config.TASK_WINDOW_START)}
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon blue"><ListTodo size={20} /></div></div><div className="stat-card-value">{stats?.TodayTasks || 0}</div><div className="stat-card-label">Today's Tasks</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon green"><Clock size={20} /></div></div><div className="stat-card-value">{stats?.TodayHours || 0}h</div><div className="stat-card-label">Today's Hours</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon purple"><TrendingUp size={20} /></div></div><div className="stat-card-value">{stats?.WeekTasks || 0}</div><div className="stat-card-label">This Week's Tasks</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon amber"><CheckCircle size={20} /></div></div><div className="stat-card-value">{stats?.PendingApprovals || 0}</div><div className="stat-card-label">Pending Approvals</div></div>
            </div>

            <div className="data-section">
                <div className="data-section-header"><h3>Recent Tasks</h3></div>
                {recentTasks.length === 0 ? (
                    <div className="empty-state"><ListTodo size={40} /><p>No tasks yet. Start by adding your first task.</p></div>
                ) : (
                    <table className="data-table">
                        <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Hours</th><th>Priority</th><th>Status</th><th>Approval</th></tr></thead>
                        <tbody>
                            {recentTasks.map(t => (
                                <tr key={t.TaskID}>
                                    <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{new Date(t.TaskDate).toLocaleDateString()}</td>
                                    <td style={{ color:'var(--text-primary)', fontWeight:500 }}>{t.TaskTitle}</td>
                                    <td>{t.CategoryName && <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12 }}><span style={{ width:8, height:8, borderRadius:'50%', background:t.ColorCode||'var(--accent-blue)' }} />{t.CategoryName}</span>}</td>
                                    <td style={{ fontFamily:'var(--font-mono)' }}>{t.ActualHours}h</td>
                                    <td><span className={'badge badge-'+t.Priority?.toLowerCase()}>{t.Priority}</span></td>
                                    <td><span className={'badge badge-'+t.Status?.toLowerCase().replace(' ','')}>{t.Status}</span></td>
                                    <td><span className={'badge badge-'+t.ApprovalStatus?.toLowerCase()}>{t.ApprovalStatus}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}