import React, { useState, useEffect } from 'react';
import { adminAPI, taskAPI } from '../services/api';
import { Users, ShieldCheck, UserCheck, ListTodo, AlertTriangle, Clock } from 'lucide-react';

function parseTime(t) { if(!t)return null; var p=t.split(':'); return {hours:parseInt(p[0],10),minutes:parseInt(p[1],10)}; }
function formatTime12(t) { if(!t)return''; var p=parseTime(t); if(!p)return t; var h=p.hours,m=p.minutes,per=h>=12?'PM':'AM',dh=h>12?h-12:h===0?12:h; return dh+':'+String(m).padStart(2,'0')+' '+per; }
function getWindowStatus(c) { var now=new Date(),cm=now.getHours()*60+now.getMinutes(),s=parseTime(c.TASK_WINDOW_START),e=parseTime(c.TASK_WINDOW_END),sm=s?s.hours*60+s.minutes:540,em=e?e.hours*60+e.minutes:660; if(cm>=sm&&cm<em)return'open'; if(cm>=em)return'closed'; return'before'; }

function CheckCircle2(props) {
    return (<svg xmlns="http://www.w3.org/2000/svg" width={props.size||24} height={props.size||24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
}

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ TASK_WINDOW_START:'09:00', TASK_WINDOW_END:'11:00', ESCALATION_TRIGGER_TIME:'11:01' });

    useEffect(() => {
        Promise.all([adminAPI.getDashboardStats(), taskAPI.getSubmissionWindow()])
            .then(([statsRes, configRes]) => {
                setStats(statsRes.data.data);
                if (configRes.data.data) setConfig(prev => ({ ...prev, ...configRes.data.data }));
            }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    var windowStatus = getWindowStatus(config);
    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    return (
        <div>
            <div style={{ background:'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))', border:'1px solid rgba(139,92,246,0.15)', borderRadius:'var(--radius-lg)', padding:'28px 32px', marginBottom:20 }}>
                <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>System Administration</h2>
                <p style={{ color:'var(--text-muted)', fontSize:14 }}>Manage users, configure escalation rules, and monitor system activity.</p>
            </div>

            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'16px 24px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Clock size={18} style={{ color: windowStatus==='open'?'var(--accent-green)':'var(--accent-amber)' }} />
                    <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
                            Submission Window: {windowStatus==='open'?'OPEN':windowStatus==='closed'?'CLOSED':'NOT YET OPEN'}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {formatTime12(config.TASK_WINDOW_START)} - {formatTime12(config.TASK_WINDOW_END)} | Escalation trigger: {formatTime12(config.ESCALATION_TRIGGER_TIME)}
                        </div>
                    </div>
                </div>
                <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
                    {stats?.UsersSubmittedToday || 0} / {stats?.TotalResources || 0} users submitted today
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon blue"><Users size={20} /></div></div><div className="stat-card-value">{stats?.TotalActiveUsers || 0}</div><div className="stat-card-label">Active Users</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon purple"><ShieldCheck size={20} /></div></div><div className="stat-card-value">{stats?.TotalManagers || 0}</div><div className="stat-card-label">Managers</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon green"><UserCheck size={20} /></div></div><div className="stat-card-value">{stats?.TotalResources || 0}</div><div className="stat-card-label">Resource Persons</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon amber"><ListTodo size={20} /></div></div><div className="stat-card-value">{stats?.TodayTasks || 0}</div><div className="stat-card-label">Tasks Today</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon green"><CheckCircle2 size={20} /></div></div><div className="stat-card-value">{stats?.UsersSubmittedToday || 0}</div><div className="stat-card-label">Users Submitted Today</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon red"><AlertTriangle size={20} /></div></div><div className="stat-card-value">{stats?.TodayEscalations || 0}</div><div className="stat-card-label">Today's Escalations</div></div>
            </div>
        </div>
    );
}