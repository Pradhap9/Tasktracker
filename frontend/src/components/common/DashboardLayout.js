import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI } from '../../services/api';
import {
    LayoutDashboard, ListTodo, Users, ShieldCheck, Settings, LogOut,
    Bell, UserCheck, Download, ClipboardList, Menu, X, Volume2
} from 'lucide-react';

// ── Audio context that persists across renders ────
let globalAudioContext = null;
let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    try {
        if (!globalAudioContext) {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (globalAudioContext.state === 'suspended') {
            globalAudioContext.resume();
        }
        // Create a silent buffer to unlock
        const buffer = globalAudioContext.createBuffer(1, 1, 22050);
        const source = globalAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(globalAudioContext.destination);
        source.start(0);
        audioUnlocked = true;
        console.log('[Sound] Audio unlocked successfully');
    } catch (e) {
        console.warn('[Sound] Audio unlock failed:', e.message);
    }
}

function playAlertSound() {
    try {
        if (!globalAudioContext) {
            globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume if suspended
        if (globalAudioContext.state === 'suspended') {
            globalAudioContext.resume();
        }

        const ctx = globalAudioContext;

        const playBeep = (startTime, freq, duration, vol) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        // Urgent alert pattern: 3 ascending beeps
        playBeep(now, 660, 0.15, 0.5);
        playBeep(now + 0.2, 880, 0.15, 0.5);
        playBeep(now + 0.4, 1100, 0.2, 0.6);
        // Repeat after pause
        playBeep(now + 0.8, 660, 0.15, 0.5);
        playBeep(now + 1.0, 880, 0.15, 0.5);
        playBeep(now + 1.2, 1100, 0.2, 0.6);

        console.log('[Sound] Alert sound played');
        return true;
    } catch (e) {
        console.warn('[Sound] Could not play alert:', e.message);

        // Fallback: use HTML5 Audio with beep data URI
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgip60teleNjdckKO2x3RAKUBslq+7x3tNMTlnkay3x3tQLjdlkK24yIFTLTVjj6y3x4NVLTVjj6y4x4VWLTVjj624x4dYLjVjkK24x4lZLjVjkK24yItaLjVjkK25yIxbLjVkkK65yY1cLjZkkK+5yY5dLzZkkK+5yY9eLzZlka+6ypBfLzZlka+6ypFfLzZlka+6ypJgMDdlka+6ypNhMDdmkrC7y5RiMDdmkrC7y5VjMTdmkrC7y5ZkMTdmkrC7y5dlMThnk7G8zJhmMjhnk7G8zJlnMjhnk7G8zJpoMzlolLK9zZtpMzlolLK9zZxqNDlolLK9zZ1rNDpplbO+zp5sNDpplbO+zp9tNTpplbO+zqBuNTtqlrS/z6FvNjtqlrS/z6JwNztrlrTA0KNxODtrlrTA0KRyODxsl7XB0aVzOTxsl7XB0aZ0OTxsl7XB0ad1Oj1tmLbC0qh2Oj1tmLbC0ql3Oz1tmLbC0qp4Oz5umbjD06t5PD5umbjD06x6PD5umbjD061');
            audio.volume = 0.5;
            audio.play();
        } catch (e2) {
            console.warn('[Sound] Fallback audio also failed:', e2.message);
        }

        return false;
    }
}

export default function DashboardLayout() {
    const { user, logout, isAdmin, isManager, unreadCount, fetchUnreadCount } = useAuth();
    const location = useLocation();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);

    const soundPlayedIds = useRef(new Set());
    const isFirstLoad = useRef(true);
    const hasUserInteracted = useRef(false);

    // Unlock audio on ANY user interaction
    useEffect(() => {
        const handleInteraction = () => {
            if (!hasUserInteracted.current) {
                hasUserInteracted.current = true;
                unlockAudio();
                console.log('[Sound] User interacted - audio ready');
            }
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('keydown', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    const pageTitle = () => {
        const path = location.pathname;
        if (path.includes('/admin/users')) return 'User Management';
        if (path.includes('/admin/config')) return 'Escalation Configuration';
        if (path.includes('/admin')) return 'Admin Dashboard';
        if (path.includes('/manager/approvals')) return 'Task Approvals';
        if (path.includes('/manager/team')) return 'Team Members';
        if (path.includes('/manager/export')) return 'Export Data';
        if (path.includes('/manager')) return 'Manager Dashboard';
        if (path.includes('/tasks')) return 'My Tasks';
        return 'Dashboard';
    };

    const loadNotifications = useCallback(async () => {
        try {
            const res = await notificationAPI.getAll();
            const all = res.data.data || [];
            setNotifications(all);

            // Find unread escalation notifications
            const unreadEscalations = all.filter(
                n => n.NotificationType === 'Escalation' && !n.IsRead && n.IsSoundPlayed === 0
            );

            if (isFirstLoad.current) {
                isFirstLoad.current = false;

                // On first load, if there are unread escalations, play sound
                if (unreadEscalations.length > 0 && hasUserInteracted.current) {
                    console.log('[Sound] First load - ' + unreadEscalations.length + ' unread escalation(s), playing sound');
                    playAlertSound();
                    setSoundEnabled(true);

                    unreadEscalations.forEach(n => soundPlayedIds.current.add(n.NotificationID));

                    try { await notificationAPI.markSoundPlayed(); } catch (e) { /* ignore */ }
                } else {
                    // Mark existing ones as seen locally
                    unreadEscalations.forEach(n => soundPlayedIds.current.add(n.NotificationID));
                }
            } else {
                // Subsequent polls: find NEW escalations we haven't seen
                const newOnes = unreadEscalations.filter(
                    n => !soundPlayedIds.current.has(n.NotificationID)
                );

                if (newOnes.length > 0) {
                    console.log('[Sound] ' + newOnes.length + ' NEW escalation(s) detected, playing sound');
                    playAlertSound();
                    setSoundEnabled(true);

                    newOnes.forEach(n => soundPlayedIds.current.add(n.NotificationID));

                    try { await notificationAPI.markSoundPlayed(); } catch (e) { /* ignore */ }
                }
            }
        } catch (e) { /* ignore */ }
    }, []);

    const handleNotificationClick = async (notif) => {
        if (!notif.IsRead) {
            await notificationAPI.markAsRead(notif.NotificationID);
            fetchUnreadCount();
            loadNotifications();
        }
    };

    const handleMarkAllRead = async () => {
        await notificationAPI.markAllAsRead();
        fetchUnreadCount();
        loadNotifications();
    };

    // Test sound button
    const handleTestSound = () => {
        unlockAudio();
        playAlertSound();
        setSoundEnabled(true);
    };

    // Poll every 30 seconds
    useEffect(() => {
        loadNotifications();
        fetchUnreadCount();

        const interval = setInterval(() => {
            loadNotifications();
            fetchUnreadCount();
        }, 30000);

        return () => clearInterval(interval);
    }, [loadNotifications, fetchUnreadCount]);

    useEffect(() => {
        if (showNotifications) loadNotifications();
    }, [showNotifications, loadNotifications]);

    const initials = user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

    return (
        <div className="app-layout">
            <button
                className="topbar-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ position: 'fixed', top: 12, left: 12, zIndex: 150, display: 'none' }}
            >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <img src="/ubti-logo.png" alt="UB Technology Innovations" className="sidebar-brand-logo" />
                        <div className="sidebar-brand-copy">
                            <h1>TaskTracker</h1>
                            <span>Internal Task Management</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">Main</div>
                    <NavLink to="/dashboard" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                        <LayoutDashboard size={18} /> Dashboard
                    </NavLink>
                    <NavLink to="/tasks" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                        <ListTodo size={18} /> My Tasks
                    </NavLink>

                    {isManager && (
                        <>
                            <div className="nav-section-label">Manager</div>
                            <NavLink to="/manager" end className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <ClipboardList size={18} /> Overview
                            </NavLink>
                            <NavLink to="/manager/approvals" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <UserCheck size={18} /> Approvals
                            </NavLink>
                            <NavLink to="/manager/team" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <Users size={18} /> Team
                            </NavLink>
                            <NavLink to="/manager/export" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <Download size={18} /> Export
                            </NavLink>
                        </>
                    )}

                    {isAdmin && (
                        <>
                            <div className="nav-section-label">Admin</div>
                            <NavLink to="/admin" end className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <ShieldCheck size={18} /> Admin Panel
                            </NavLink>
                            <NavLink to="/admin/users" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <Users size={18} /> Users
                            </NavLink>
                            <NavLink to="/admin/config" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}>
                                <Settings size={18} /> Configuration
                            </NavLink>
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-card">
                        <div className="user-avatar">{initials}</div>
                        <div className="user-card-info" style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.fullName}
                            </h4>
                            <span>{user?.role} | {user?.department}</span>
                        </div>
                    </div>
                    <button onClick={logout} className="nav-item" style={{ marginTop: 8, color: 'var(--accent-red)', width: '100%' }}>
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div className="topbar-left">
                        <h2>{pageTitle()}</h2>
                    </div>
                    <div className="topbar-right">
                        {/* Test Sound Button */}
                        <button
                            className="topbar-btn"
                            onClick={handleTestSound}
                            title="Test alert sound"
                            style={{ color: soundEnabled ? 'var(--accent-green)' : 'var(--text-muted)' }}
                        >
                            <Volume2 size={18} />
                        </button>

                        {/* Notifications */}
                        <button
                            className="topbar-btn"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                            )}
                        </button>
                    </div>
                </header>

                <div className="page-content">
                    <Outlet />
                </div>
            </main>

            {showNotifications && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 150 }}
                        onClick={() => setShowNotifications(false)}
                    />
                    <div className="notification-panel">
                        <div className="notification-panel-header">
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Notifications</h3>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-xs" onClick={handleMarkAllRead}>
                                    Mark all read
                                </button>
                                <button className="modal-close" onClick={() => setShowNotifications(false)}>
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="notification-list">
                            {notifications.length === 0 ? (
                                <div className="empty-state" style={{ padding: 40 }}>
                                    <Bell size={40} />
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.NotificationID}
                                        className={'notification-item ' + (!n.IsRead ? 'unread ' : '') + (n.NotificationType === 'Escalation' ? 'escalation' : '')}
                                        onClick={() => handleNotificationClick(n)}
                                    >
                                        <div className="notification-item-title">{n.Title}</div>
                                        <div className="notification-item-message">{n.Message}</div>
                                        <div className="notification-item-time">
                                            {new Date(n.CreatedAt).toLocaleString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
