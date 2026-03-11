import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Plus, Edit2, Trash2, X, Users, Key, UserPlus } from 'lucide-react';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUserId, setResetUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [form, setForm] = useState({
        employeeCode: '', fullName: '', email: '', password: '',
        roleId: 3, managerId: '', department: '', designation: '', phone: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [usersRes, mgrsRes, rolesRes] = await Promise.all([
                adminAPI.getUsers(), adminAPI.getManagers(), adminAPI.getRoles()
            ]);
            setUsers(usersRes.data.data || []);
            setManagers(mgrsRes.data.data || []);
            setRoles(rolesRes.data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const openCreate = () => {
        setEditingUser(null);
        setForm({ employeeCode: '', fullName: '', email: '', password: '', roleId: 3, managerId: '', department: '', designation: '', phone: '' });
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setForm({
            employeeCode: u.EmployeeCode, fullName: u.FullName, email: u.Email, password: '',
            roleId: u.RoleID, managerId: u.ManagerID || '', department: u.Department || '',
            designation: u.Designation || '', phone: u.Phone || '', isActive: u.IsActive
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await adminAPI.updateUser(editingUser.UserID, form);
            } else {
                if (!form.password) return alert('Password is required for new users.');
                await adminAPI.createUser(form);
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save user.');
        }
    };

    const handleDeactivate = async (userId) => {
        if (!window.confirm('Deactivate this user?')) return;
        try {
            await adminAPI.deleteUser(userId);
            loadData();
        } catch (e) { alert('Failed to deactivate.'); }
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) return alert('Password must be at least 6 characters.');
        try {
            await adminAPI.resetPassword(resetUserId, { newPassword });
            setShowResetModal(false);
            setNewPassword('');
            alert('Password reset successfully.');
        } catch (e) { alert('Failed to reset password.'); }
    };

    if (loading) return <div className="empty-state"><p>Loading...</p></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {users.length} total users | {users.filter(u => u.IsActive).length} active
                    </span>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <UserPlus size={16} /> Add User
                </button>
            </div>

            <div className="data-section">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Code</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Manager</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.UserID} style={{ opacity: u.IsActive ? 1 : 0.5 }}>
                                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.FullName}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.EmployeeCode}</td>
                                <td style={{ fontSize: 12 }}>{u.Email}</td>
                                <td>
                                    <span className={`badge ${u.RoleName === 'Admin' ? 'badge-critical' : u.RoleName === 'Manager' ? 'badge-inprogress' : 'badge-low'}`}>
                                        {u.RoleName}
                                    </span>
                                </td>
                                <td style={{ fontSize: 13 }}>{u.ManagerName || '-'}</td>
                                <td>{u.Department || '-'}</td>
                                <td>
                                    <span className={`badge ${u.IsActive ? 'badge-approved' : 'badge-rejected'}`}>
                                        {u.IsActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>
                                    <div className="btn-group">
                                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(u)}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-xs"
                                            onClick={() => { setResetUserId(u.UserID); setShowResetModal(true); }}>
                                            <Key size={14} />
                                        </button>
                                        {u.IsActive && (
                                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--accent-red)' }}
                                                onClick={() => handleDeactivate(u.UserID)}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Employee Code *</label>
                                        <input type="text" className="form-input" required placeholder="EMP001"
                                            value={form.employeeCode} disabled={!!editingUser}
                                            onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input type="text" className="form-input" required placeholder="John Doe"
                                            value={form.fullName}
                                            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input type="email" className="form-input" required placeholder="name@ubtiinc.com"
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    {!editingUser && (
                                        <div className="form-group">
                                            <label className="form-label">Password *</label>
                                            <input type="password" className="form-input" required={!editingUser} placeholder="Min 6 chars"
                                                value={form.password}
                                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                                        </div>
                                    )}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Role *</label>
                                        <select className="form-select" value={form.roleId}
                                            onChange={e => setForm(f => ({ ...f, roleId: parseInt(e.target.value) }))}>
                                            {roles.map(r => (
                                                <option key={r.RoleID} value={r.RoleID}>{r.RoleName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reporting Manager</label>
                                        <select className="form-select" value={form.managerId}
                                            onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}>
                                            <option value="">None</option>
                                            {managers.map(m => (
                                                <option key={m.UserID} value={m.UserID}>{m.FullName} ({m.EmployeeCode})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row-3">
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <input type="text" className="form-input" placeholder="Engineering"
                                            value={form.department}
                                            onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Designation</label>
                                        <input type="text" className="form-input" placeholder="Developer"
                                            value={form.designation}
                                            onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone</label>
                                        <input type="text" className="form-input" placeholder="+91..."
                                            value={form.phone}
                                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                                    </div>
                                </div>

                                {editingUser && (
                                    <div className="form-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                                            <input type="checkbox" checked={form.isActive !== false}
                                                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                                            Active User
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingUser ? 'Update User' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && (
                <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Reset Password</h3>
                            <button className="modal-close" onClick={() => setShowResetModal(false)}><X size={14} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">New Password</label>
                                <input type="password" className="form-input" placeholder="Enter new password"
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowResetModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleResetPassword}>Reset Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
