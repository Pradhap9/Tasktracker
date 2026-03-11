import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FolderKanban, Plus, ClipboardPlus, X, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { managerAPI, projectAPI, taskAPI } from '../services/api';

const today = () => new Date().toISOString().split('T')[0];

export default function ProjectsPage() {
    const { user } = useAuth();
    const canManageProjects = user?.role === 'Manager';
    const canViewProjects = canManageProjects || user?.role === 'User';
    const [projects, setProjects] = useState([]);
    const [team, setTeam] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [projectForm, setProjectForm] = useState({
        projectName: '',
        description: '',
        assignedTo: '',
        status: 'Planned',
        priority: 'Medium',
        startDate: '',
        endDate: ''
    });
    const [taskForm, setTaskForm] = useState({
        userId: '',
        projectId: '',
        categoryId: '',
        taskDate: today(),
        taskTitle: '',
        taskDescription: '',
        plannedHours: '',
        priority: 'Medium',
        dueDate: ''
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const projectPromise = projectAPI.getAll();
            const teamPromise = canManageProjects ? managerAPI.getTeam() : Promise.resolve({ data: { data: [] } });
            const categoriesPromise = canManageProjects ? taskAPI.getCategories() : Promise.resolve({ data: { data: [] } });

            const [projectRes, teamRes, categoriesRes] = await Promise.all([
                projectPromise,
                teamPromise,
                categoriesPromise
            ]);

            setProjects(projectRes.data.data || []);
            setTeam(teamRes.data.data || []);
            setCategories(categoriesRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [canManageProjects]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const assignedProjects = useMemo(
        () => projects.filter((project) => project.AssignedTo === user?.userId),
        [projects, user]
    );

    const openProjectModal = (project = null) => {
        setEditingProject(project);
        setProjectForm(project ? {
            projectName: project.ProjectName || '',
            description: project.Description || '',
            assignedTo: project.AssignedTo || '',
            status: project.Status || 'Planned',
            priority: project.Priority || 'Medium',
            startDate: project.StartDate?.split('T')[0] || '',
            endDate: project.EndDate?.split('T')[0] || ''
        } : {
            projectName: '',
            description: '',
            assignedTo: '',
            status: 'Planned',
            priority: 'Medium',
            startDate: '',
            endDate: ''
        });
        setShowProjectModal(true);
    };

    const openTaskModal = () => {
        setTaskForm({
            userId: team[0]?.UserID || '',
            projectId: projects[0]?.ProjectID || '',
            categoryId: '',
            taskDate: today(),
            taskTitle: '',
            taskDescription: '',
            plannedHours: '',
            priority: 'Medium',
            dueDate: ''
        });
        setShowTaskModal(true);
    };

    const handleProjectSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProject) {
                await projectAPI.update(editingProject.ProjectID, projectForm);
            } else {
                await projectAPI.create(projectForm);
            }
            setShowProjectModal(false);
            loadData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save project.');
        }
    };

    const handleTaskAssign = async (e) => {
        e.preventDefault();
        try {
            await managerAPI.assignTask({
                ...taskForm,
                projectId: taskForm.projectId || null,
                categoryId: taskForm.categoryId || null
            });
            setShowTaskModal(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to assign task.');
        }
    };

    if (!canViewProjects) {
        return <div className="empty-state"><p>Projects are available only for managers and assigned users.</p></div>;
    }

    if (loading) return <div className="empty-state"><p>Loading projects...</p></div>;

    const visibleProjects = canManageProjects ? projects : assignedProjects;

    return (
        <div>
            {canManageProjects && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Manage projects and assign work to your resource persons.
                    </div>
                    <div className="btn-group">
                        <button className="btn btn-outline" onClick={openTaskModal}>
                            <ClipboardPlus size={16} /> Assign Task
                        </button>
                        <button className="btn btn-primary" onClick={() => openProjectModal()}>
                            <Plus size={16} /> Add Project
                        </button>
                    </div>
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon blue"><FolderKanban size={20} /></div></div><div className="stat-card-value">{visibleProjects.length}</div><div className="stat-card-label">{canManageProjects ? 'Managed Projects' : 'Assigned Projects'}</div></div>
                <div className="stat-card"><div className="stat-card-header"><div className="stat-card-icon green"><FolderKanban size={20} /></div></div><div className="stat-card-value">{visibleProjects.filter(p => p.Status !== 'Completed').length}</div><div className="stat-card-label">Active Projects</div></div>
            </div>

            <div className="data-section">
                <div className="data-section-header">
                    <h3>{canManageProjects ? `Projects (${visibleProjects.length})` : `Assigned Projects (${visibleProjects.length})`}</h3>
                </div>
                {visibleProjects.length === 0 ? (
                    <div className="empty-state">
                        <FolderKanban size={40} />
                        <p>{canManageProjects ? 'No projects yet. Create one and assign it to a resource person.' : 'No projects have been assigned to you yet.'}</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Assignee</th>
                                <th>Timeline</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Open Tasks</th>
                                {canManageProjects && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleProjects.map((project) => (
                                <tr key={project.ProjectID}>
                                    <td>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{project.ProjectName}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280 }}>
                                            {project.Description || 'No description'}
                                        </div>
                                    </td>
                                    <td>{project.AssignedUserName || '-'}</td>
                                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                                        {(project.StartDate ? new Date(project.StartDate).toLocaleDateString() : '-') + ' to ' + (project.EndDate ? new Date(project.EndDate).toLocaleDateString() : '-')}
                                    </td>
                                    <td><span className={`badge badge-${project.Priority?.toLowerCase()}`}>{project.Priority}</span></td>
                                    <td><span className={`badge badge-${project.Status?.toLowerCase().replace(' ', '')}`}>{project.Status}</span></td>
                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{project.OpenTaskCount || 0}</td>
                                    {canManageProjects && (
                                        <td>
                                            <button className="btn btn-ghost btn-xs" onClick={() => openProjectModal(project)}>
                                                <Edit2 size={14} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showProjectModal && (
                <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingProject ? 'Edit Project' : 'Create Project'}</h3>
                            <button className="modal-close" onClick={() => setShowProjectModal(false)}><X size={14} /></button>
                        </div>
                        <form onSubmit={handleProjectSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Project Name *</label>
                                        <input className="form-input" required value={projectForm.projectName} onChange={(e) => setProjectForm((f) => ({ ...f, projectName: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Assignee *</label>
                                        <select className="form-select" required value={projectForm.assignedTo} onChange={(e) => setProjectForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                                            <option value="">Select resource person</option>
                                            {team.map((member) => (
                                                <option key={member.UserID} value={member.UserID}>{member.FullName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" value={projectForm.description} onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))} />
                                </div>
                                <div className="form-row-3">
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select className="form-select" value={projectForm.status} onChange={(e) => setProjectForm((f) => ({ ...f, status: e.target.value }))}>
                                            <option value="Planned">Planned</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Completed">Completed</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-select" value={projectForm.priority} onChange={(e) => setProjectForm((f) => ({ ...f, priority: e.target.value }))}>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Start Date</label>
                                        <input type="date" className="form-input" value={projectForm.startDate} onChange={(e) => setProjectForm((f) => ({ ...f, startDate: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date</label>
                                    <input type="date" className="form-input" value={projectForm.endDate} onChange={(e) => setProjectForm((f) => ({ ...f, endDate: e.target.value }))} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowProjectModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingProject ? 'Update Project' : 'Create Project'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTaskModal && (
                <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Assign Task</h3>
                            <button className="modal-close" onClick={() => setShowTaskModal(false)}><X size={14} /></button>
                        </div>
                        <form onSubmit={handleTaskAssign}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Assignee *</label>
                                        <select className="form-select" required value={taskForm.userId} onChange={(e) => setTaskForm((f) => ({ ...f, userId: e.target.value }))}>
                                            <option value="">Select resource person</option>
                                            {team.map((member) => (
                                                <option key={member.UserID} value={member.UserID}>{member.FullName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Project</label>
                                        <select className="form-select" value={taskForm.projectId} onChange={(e) => setTaskForm((f) => ({ ...f, projectId: e.target.value }))}>
                                            <option value="">No project</option>
                                            {projects.map((project) => (
                                                <option key={project.ProjectID} value={project.ProjectID}>{project.ProjectName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Task Date *</label>
                                        <input type="date" className="form-input" required value={taskForm.taskDate} onChange={(e) => setTaskForm((f) => ({ ...f, taskDate: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select className="form-select" value={taskForm.categoryId} onChange={(e) => setTaskForm((f) => ({ ...f, categoryId: e.target.value }))}>
                                            <option value="">Select category</option>
                                            {categories.map((category) => (
                                                <option key={category.CategoryID} value={category.CategoryID}>{category.CategoryName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Task Title *</label>
                                    <input className="form-input" required value={taskForm.taskTitle} onChange={(e) => setTaskForm((f) => ({ ...f, taskTitle: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-textarea" value={taskForm.taskDescription} onChange={(e) => setTaskForm((f) => ({ ...f, taskDescription: e.target.value }))} />
                                </div>
                                <div className="form-row-3">
                                    <div className="form-group">
                                        <label className="form-label">Planned Hours</label>
                                        <input type="number" className="form-input" min="0" step="0.5" value={taskForm.plannedHours} onChange={(e) => setTaskForm((f) => ({ ...f, plannedHours: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Priority</label>
                                        <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input type="date" className="form-input" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-outline" onClick={() => setShowTaskModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Assign Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
