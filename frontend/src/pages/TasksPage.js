import React, { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../services/api';
import { Plus, Edit2, Trash2, X, ListTodo, Filter } from 'lucide-react';

export default function TasksPage() {
    const [tasks, setTasks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '' });
    const [form, setForm] = useState({
        taskDate: new Date().toISOString().split('T')[0],
        taskTitle: '', taskDescription: '', categoryId: '', plannedHours: '',
        actualHours: '', priority: 'Medium', status: 'Pending', dueDate: ''
    });

    const loadTasks = useCallback(async () => {
        try {
            const params = {};
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.status) params.status = filters.status;
            const res = await taskAPI.getAll(params);
            setTasks(res.data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [filters]);

    const loadCategories = async () => {
        try {
            const res = await taskAPI.getCategories();
            setCategories(res.data.data || []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadTasks(); loadCategories(); }, [loadTasks]);

    const openCreate = () => {
        setEditingTask(null);
        setForm({
            taskDate: new Date().toISOString().split('T')[0],
            taskTitle: '', taskDescription: '', categoryId: '', plannedHours: '',
            actualHours: '', priority: 'Medium', status: 'Pending', dueDate: ''
        });
        setShowModal(true);
    };

    const openEdit = (task) => {
        setEditingTask(task);
        setForm({
            taskDate: task.TaskDate?.split('T')[0] || '',
            taskTitle: task.TaskTitle || '',
            taskDescription: task.TaskDescription || '',
            categoryId: task.CategoryID || '',
            plannedHours: task.PlannedHours || '',
            actualHours: task.ActualHours || '',
            priority: task.Priority || 'Medium',
            status: task.Status || 'Pending',
            dueDate: task.DueDate?.split('T')[0] || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = { ...form, categoryId: form.categoryId || null };
            if (editingTask) {
                await taskAPI.update(editingTask.TaskID, data);
            } else {
                await taskAPI.create(data);
            }
            setShowModal(false);
            loadTasks();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save task.');
        }
    };

    const handleDelete = async (taskId) => {
        if (!window.confirm('Delete this task? Only pending tasks can be deleted.')) return;
        try {
            await taskAPI.delete(taskId);
            loadTasks();
        } catch (err) {
            alert(err.response?.data?.message || 'Cannot delete this task.');
        }
    };

    if (loading) return <div className="empty-state"><p>Loading tasks...</p></div>;

    return (
        <div>
            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div className="filter-bar">
                    <input type="date" className="form-input" value={filters.startDate}
                        onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                    <input type="date" className="form-input" value={filters.endDate}
                        onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                    <select className="form-select" value={filters.status}
                        onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                        <option value="">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Add Task
                </button>
            </div>

            {/* Tasks Table */}
            <div className="data-section">
                <div className="data-section-header">
                    <h3>Tasks ({tasks.length})</h3>
                </div>
                {tasks.length === 0 ? (
                    <div className="empty-state">
                        <ListTodo size={40} />
                        <p>No tasks found. Click "Add Task" to get started.</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Planned</th>
                                <th>Actual</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Approval</th>
                                <th>Hours Approval</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map(t => (
                                <tr key={t.TaskID}>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                        {new Date(t.TaskDate).toLocaleDateString()}
                                    </td>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 250 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {t.TaskTitle}
                                        </div>
                                    </td>
                                    <td>
                                        {t.CategoryName && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.ColorCode }} />
                                                {t.CategoryName}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{t.PlannedHours}h</td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{t.ActualHours}h</td>
                                    <td><span className={`badge badge-${t.Priority?.toLowerCase()}`}>{t.Priority}</span></td>
                                    <td><span className={`badge badge-${t.Status?.toLowerCase().replace(' ', '')}`}>{t.Status}</span></td>
                                    <td><span className={`badge badge-${t.ApprovalStatus?.toLowerCase()}`}>{t.ApprovalStatus}</span></td>
                                    <td><span className={`badge badge-${t.HoursApprovalStatus?.toLowerCase()}`}>{t.HoursApprovalStatus}</span></td>
                                    <td>
                                        <div className="btn-group">
                                            <button className="btn btn-ghost btn-xs" onClick={() => openEdit(t)}><Edit2 size={14} /></button>
                                            {t.ApprovalStatus === 'Pending' && (
                                                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--accent-red)' }}
                                                    onClick={() => handleDelete(t.TaskID)}><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Task Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Task Date *</label>
                                        <input type="date" className="form-input" required
                                            value={form.taskDate}
                                            onChange={e => setForm(f => ({ ...f, taskDate: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-select" value={form.categoryId}
                                            onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                                            <option value="">Select Category</option>
                                            {categories.map(c => (
                                                <option key={c.CategoryID} value={c.CategoryID}>{c.CategoryName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Task Title *</label>
                                    <input type="text" className="form-input" required placeholder="Enter task title"
                                        value={form.taskTitle}
                                        onChange={e => setForm(f => ({ ...f, taskTitle: e.target.value }))} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" placeholder="Task details..."
                                        value={form.taskDescription}
                                        onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))} />
                                </div>

                                <div className="form-row-3">
                                    <div className="form-group">
                                        <label className="form-label">Planned Hours</label>
                                        <input type="number" className="form-input" step="0.5" min="0" max="24"
                                            placeholder="0" value={form.plannedHours}
                                            onChange={e => setForm(f => ({ ...f, plannedHours: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Actual Hours</label>
                                        <input type="number" className="form-input" step="0.5" min="0" max="24"
                                            placeholder="0" value={form.actualHours}
                                            onChange={e => setForm(f => ({ ...f, actualHours: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-select" value={form.priority}
                                            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-select" value={form.status}
                                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="On Hold">On Hold</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input type="date" className="form-input" value={form.dueDate}
                                            onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTask ? 'Update Task' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
