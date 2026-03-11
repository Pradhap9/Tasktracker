const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { getCurrentDateInTimeZone } = require('../utils/time');

const getAllUsers = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                u.user_id AS "UserID",
                u.employee_code AS "EmployeeCode",
                u.full_name AS "FullName",
                u.email AS "Email",
                u.role_id AS "RoleID",
                r.role_name AS "RoleName",
                u.manager_id AS "ManagerID",
                m.full_name AS "ManagerName",
                u.department AS "Department",
                u.designation AS "Designation",
                u.phone AS "Phone",
                u.is_active AS "IsActive",
                u.last_login_at AS "LastLoginAt",
                u.created_at AS "CreatedAt"
            FROM tasktracker.users u
            JOIN tasktracker.roles r ON u.role_id = r.role_id
            LEFT JOIN tasktracker.users m ON u.manager_id = m.user_id
            ORDER BY u.full_name
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Admin] Get users error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const createUser = async (req, res) => {
    try {
        const {
            employeeCode, fullName, email, password, roleId,
            managerId, department, designation, phone
        } = req.body;

        if (!employeeCode || !fullName || !email || !password || !roleId) {
            return res.status(400).json({ success: false, message: 'Required fields missing.' });
        }

        const existing = await query(`
            SELECT user_id AS "UserID"
            FROM tasktracker.users
            WHERE LOWER(email) = LOWER($1) OR employee_code = $2
            LIMIT 1
        `, [email, employeeCode]);

        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'User with this email or employee code already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(`
            INSERT INTO tasktracker.users (
                employee_code, full_name, email, password_hash, role_id,
                manager_id, department, designation, phone
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                user_id AS "UserID",
                employee_code AS "EmployeeCode",
                full_name AS "FullName",
                email AS "Email"
        `, [
            employeeCode,
            fullName,
            email,
            hashedPassword,
            roleId,
            managerId || null,
            department || null,
            designation || null,
            phone || null
        ]);

        res.status(201).json({ success: true, message: 'User created successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('[Admin] Create user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { fullName, email, roleId, managerId, department, designation, phone, isActive } = req.body;

        await query(`
            UPDATE tasktracker.users
            SET
                full_name = $1,
                email = $2,
                role_id = $3,
                manager_id = $4,
                department = $5,
                designation = $6,
                phone = $7,
                is_active = $8,
                updated_at = NOW()
            WHERE user_id = $9
        `, [
            fullName,
            email,
            roleId,
            managerId || null,
            department || null,
            designation || null,
            phone || null,
            isActive !== undefined ? isActive : true,
            req.params.id
        ]);

        res.json({ success: true, message: 'User updated successfully.' });
    } catch (err) {
        console.error('[Admin] Update user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const resetUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE tasktracker.users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
            [hashedPassword, req.params.id]
        );

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        console.error('[Admin] Reset password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const deleteUser = async (req, res) => {
    try {
        await query(
            'UPDATE tasktracker.users SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1',
            [req.params.id]
        );

        res.json({ success: true, message: 'User deactivated.' });
    } catch (err) {
        console.error('[Admin] Delete user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getManagers = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                user_id AS "UserID",
                employee_code AS "EmployeeCode",
                full_name AS "FullName",
                email AS "Email",
                department AS "Department"
            FROM tasktracker.users
            WHERE role_id IN (1, 2) AND is_active = TRUE
            ORDER BY full_name
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Admin] Get managers error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getRoles = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                role_id AS "RoleID",
                role_name AS "RoleName"
            FROM tasktracker.roles
            ORDER BY role_id
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Admin] Get roles error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getEscalationConfig = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                config_key AS "ConfigKey",
                config_value AS "ConfigValue",
                description AS "Description",
                updated_at AS "UpdatedAt"
            FROM tasktracker.escalation_config
            ORDER BY config_key
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Admin] Config error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const updateEscalationConfig = async (req, res) => {
    try {
        const { value } = req.body;
        await query(`
            UPDATE tasktracker.escalation_config
            SET config_value = $1, updated_at = NOW()
            WHERE config_key = $2
        `, [value, req.params.key]);

        res.json({ success: true, message: 'Configuration updated.' });
    } catch (err) {
        console.error('[Admin] Update config error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getAdminDashboardStats = async (req, res) => {
    try {
        const today = getCurrentDateInTimeZone();
        const result = await query(`
            SELECT
                (SELECT COUNT(*)::int FROM tasktracker.users WHERE is_active = TRUE) AS "TotalActiveUsers",
                (SELECT COUNT(*)::int FROM tasktracker.users WHERE role_id = 2 AND is_active = TRUE) AS "TotalManagers",
                (SELECT COUNT(*)::int FROM tasktracker.users WHERE role_id = 3 AND is_active = TRUE) AS "TotalResources",
                (SELECT COUNT(*)::int FROM tasktracker.tasks WHERE task_date = $1) AS "TodayTasks",
                (SELECT COUNT(DISTINCT user_id)::int FROM tasktracker.tasks WHERE task_date = $1) AS "UsersSubmittedToday",
                (SELECT COUNT(*)::int FROM tasktracker.escalation_log WHERE escalation_date = $1) AS "TodayEscalations",
                (SELECT COUNT(*)::int FROM tasktracker.tasks WHERE approval_status = 'Pending') AS "PendingApprovals"
        `, [today]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Admin] Dashboard error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const assignManagerToUser = async (req, res) => {
    try {
        const { userId, managerId } = req.body;
        await query(
            'UPDATE tasktracker.users SET manager_id = $1, updated_at = NOW() WHERE user_id = $2',
            [managerId, userId]
        );

        res.json({ success: true, message: 'Manager assigned successfully.' });
    } catch (err) {
        console.error('[Admin] Assign manager error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = {
    getAllUsers, createUser, updateUser, resetUserPassword, deleteUser,
    getManagers, getRoles, getEscalationConfig, updateEscalationConfig,
    getAdminDashboardStats, assignManagerToUser
};
