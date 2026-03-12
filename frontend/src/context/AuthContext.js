import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI, healthAPI, notificationAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('tt_token'));
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const savedUser = localStorage.getItem('tt_user');
        if (savedUser && token) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, [token]);

    const fetchUnreadCount = useCallback(async () => {
        if (!token) return;
        try {
            const res = await notificationAPI.getUnreadCount();
            setUnreadCount(res.data.data.count);
        } catch (e) { /* ignore */ }
    }, [token]);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (!token) return undefined;

        const keepAlive = () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) return;
            healthAPI.ping().catch(() => { /* ignore */ });
        };

        keepAlive();
        const interval = setInterval(keepAlive, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [token]);

    const login = async (email, password) => {
        const res = await authAPI.login({ email, password });
        const { token: newToken, user: userData } = res.data.data;
        localStorage.setItem('tt_token', newToken);
        localStorage.setItem('tt_user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('tt_token');
        localStorage.removeItem('tt_user');
        setToken(null);
        setUser(null);
        setUnreadCount(0);
    };

    const isAdmin = user?.role === 'Admin';
    const isManager = user?.role === 'Manager' || user?.role === 'Admin';
    const isUser = user?.role === 'User';

    return (
        <AuthContext.Provider value={{
            user, token, loading, login, logout,
            isAdmin, isManager, isUser,
            unreadCount, fetchUnreadCount
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
