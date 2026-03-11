import React, { useState, useEffect, useCallback } from 'react';
import { managerAPI } from '../services/api';
import { CheckCircle, XCircle, Clock, ListTodo } from 'lucide-react';

export default function ManagerApprovals() {
    const [tasks, setTasks] = useState([]);
    const [team, setTeam] = useState([]);
    const [filters, setFilters] = useState({ userId: '', status: 'Pending', startDate: '', endDate: '' });
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [tasksRes, teamRes] = await Promise.all([
                managerAPI.getTeamTasks(filters),
                managerAPI.getTeam()
            ]);
            setTasks(tasksRes.data.data || []);
            setTeam(teamRes.data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleApproval = async (taskId, approvalStatus) => {
        const comments = approvalStatus === 'Rejected'
            ? prompt('Reason for rejection:')
            : '';
        if (approvalStatus === 'Rejected' && !comments) return;

        try {
            await managerAPI.approveTask(taskId, { approvalStatus, comments });
            loadData();
        } catch (e) { alert(e.response?.data?.message || 'Action failed.'); }
    };

    const handleHoursApproval = async (taskId, status) => {
        try {
            await managerAPI.approveHours(taskId, { hoursApprovalStatus: status });
            loadData();
        } catch (e) { alert(e.response?.data?.message || 'Action failed.'); }
    };

    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div className="filter-bar">
                    <select className="form-select" value={filters.userId}
                        onChange={e => setFilters(f => ({ ...f, userId: e.target.value }))}>
                        <option value="">All Members</option>
                        {team.map(m => (
                            <option key={m.UserID} value={m.UserID}>{m.FullName}</option>
                        ))}
                    </select>
                    <select className="form-select" value={filters.status}
                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                        <option value="">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                    <input type="date" className="form-input" value={filters.startDate}
                        onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                    <input type="date" className="form-input" value={filters.endDate}
                        onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                </div>
            </div>

            <div className="data-section">
                <div className="data-section-header">
                    <h3>Team Task Approvals ({tasks.length})</h3>
                </div>
                {tasks.length === 0 ? (
                    <div className="empty-state">
                        <ListTodo size={40} />
                        <p>No tasks matching the selected filters.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Date</th>
                                <th>Task</th>
                                <th>Category</th>
                                <th>Hours</th>
                                <th>Priority</th>
                                <th>Task Approval</th>
                                <th>Hours Approval</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map(t => (
                                <tr key={t.TaskID}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>
                                        {t.UserName}
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {t.EmployeeCode}
                                        </div>
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                        {new Date(t.TaskDate).toLocaleDateString()}
                                    </td>
                                    <td style={{ maxWidth: 200 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-primary)' }}>
                                            {t.TaskTitle}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 12 }}>{t.CategoryName || '-'}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{t.ActualHours}h</td>
                                    <td><span className={`badge badge-${t.Priority?.toLowerCase()}`}>{t.Priority}</span></td>
                                    <td><span className={`badge badge-${t.ApprovalStatus?.toLowerCase()}`}>{t.ApprovalStatus}</span></td>
                                    <td><span className={`badge badge-${t.HoursApprovalStatus?.toLowerCase()}`}>{t.HoursApprovalStatus}</span></td>
                                    <td>
                                        <div className="btn-group" style={{ flexWrap: 'wrap' }}>
                                            {t.ApprovalStatus === 'Pending' && (
                                                <>
                                                    <button className="btn btn-success btn-xs"
                                                        onClick={() => handleApproval(t.TaskID, 'Approved')}>
                                                        <CheckCircle size={12} /> Approve
                                                    </button>
                                                    <button className="btn btn-danger btn-xs"
                                                        onClick={() => handleApproval(t.TaskID, 'Rejected')}>
                                                        <XCircle size={12} /> Reject
                                                    </button>
                                                </>
                                            )}
                                            {t.HoursApprovalStatus === 'Pending' && t.ActualHours > 0 && (
                                                <button className="btn btn-outline btn-xs"
                                                    onClick={() => handleHoursApproval(t.TaskID, 'Approved')}>
                                                    <Clock size={12} /> Approve Hrs
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
