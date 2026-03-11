import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://10.48.4.237:5000/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('tt_token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('tt_token');
            localStorage.removeItem('tt_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    getProfile: () => api.get('/auth/profile'),
    changePassword: (data) => api.put('/auth/change-password', data),
};

export const taskAPI = {
    getAll: (params) => api.get('/tasks', { params }),
    getById: (id) => api.get('/tasks/' + id),
    create: (data) => api.post('/tasks', data),
    update: (id, data) => api.put('/tasks/' + id, data),
    delete: (id) => api.delete('/tasks/' + id),
    getDashboardStats: () => api.get('/tasks/dashboard/stats'),
    getCategories: () => api.get('/tasks/categories'),
    getSubmissionWindow: () => api.get('/tasks/config/submission-window'),
};

export const managerAPI = {
    getDashboardStats: () => api.get('/manager/dashboard-stats'),
    getTeam: () => api.get('/manager/team'),
    getTeamTasks: (params) => api.get('/manager/team-tasks', { params }),
    approveTask: (taskId, data) => api.put('/manager/approve-task/' + taskId, data),
    approveHours: (taskId, data) => api.put('/manager/approve-hours/' + taskId, data),
    assignTask: (data) => api.post('/manager/assign-task', data),
    getEscalations: () => api.get('/manager/escalations'),
    dismissEscalation: (id) => api.put('/manager/escalations/' + id + '/dismiss'),
    exportData: (format, params) => api.get('/manager/export/' + format, { params, responseType: 'blob' }),
};

export const projectAPI = {
    getAll: () => api.get('/projects'),
    create: (data) => api.post('/projects', data),
    update: (id, data) => api.put('/projects/' + id, data),
};

export const adminAPI = {
    getDashboardStats: () => api.get('/admin/dashboard-stats'),
    getUsers: () => api.get('/admin/users'),
    createUser: (data) => api.post('/admin/users', data),
    updateUser: (id, data) => api.put('/admin/users/' + id, data),
    resetPassword: (id, data) => api.put('/admin/users/' + id + '/reset-password', data),
    deleteUser: (id) => api.delete('/admin/users/' + id),
    getManagers: () => api.get('/admin/managers'),
    getRoles: () => api.get('/admin/roles'),
    assignManager: (data) => api.post('/admin/assign-manager', data),
    getEscalationConfig: () => api.get('/admin/escalation-config'),
    updateEscalationConfig: (key, data) => api.put('/admin/escalation-config/' + key, data),
};

export const notificationAPI = {
    getAll: () => api.get('/notifications'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAsRead: (id) => api.put('/notifications/' + id + '/read'),
    markAllAsRead: () => api.put('/notifications/read-all'),
    markSoundPlayed: () => api.put('/notifications/sound-played'),
};

export default api;
