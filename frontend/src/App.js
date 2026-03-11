import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/common/DashboardLayout';
import UserDashboard from './pages/UserDashboard';
import TasksPage from './pages/TasksPage';
import ProjectsPage from './pages/ProjectsPage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerApprovals from './pages/ManagerApprovals';
import ManagerTeam from './pages/ManagerTeam';
import ManagerExport from './pages/ManagerExport';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminConfig from './pages/AdminConfig';

function PrivateRoute({ children, roles }) {
    const { user, token } = useAuth();
    if (!token) return <Navigate to="/login" />;
    if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" />;
    return children;
}

function App() {
    const { token, user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/dashboard" />} />

            <Route path="/" element={
                <PrivateRoute><DashboardLayout /></PrivateRoute>
            }>
                <Route index element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<UserDashboard />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="projects" element={<ProjectsPage />} />

                {/* Manager Routes */}
                <Route path="manager" element={
                    <PrivateRoute roles={['Manager', 'Admin']}><ManagerDashboard /></PrivateRoute>
                } />
                <Route path="manager/approvals" element={
                    <PrivateRoute roles={['Manager', 'Admin']}><ManagerApprovals /></PrivateRoute>
                } />
                <Route path="manager/team" element={
                    <PrivateRoute roles={['Manager', 'Admin']}><ManagerTeam /></PrivateRoute>
                } />
                <Route path="manager/export" element={
                    <PrivateRoute roles={['Manager', 'Admin']}><ManagerExport /></PrivateRoute>
                } />

                {/* Admin Routes */}
                <Route path="admin" element={
                    <PrivateRoute roles={['Admin']}><AdminDashboard /></PrivateRoute>
                } />
                <Route path="admin/users" element={
                    <PrivateRoute roles={['Admin']}><AdminUsers /></PrivateRoute>
                } />
                <Route path="admin/config" element={
                    <PrivateRoute roles={['Admin']}><AdminConfig /></PrivateRoute>
                } />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
    );
}

export default App;
