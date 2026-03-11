const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { getCurrentDateInTimeZone } = require('../utils/time');
require('dotenv').config();

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const result = await query(`
            SELECT
                u.user_id AS "UserID",
                u.employee_code AS "EmployeeCode",
                u.full_name AS "FullName",
                u.email AS "Email",
                u.password_hash AS "PasswordHash",
                u.role_id AS "RoleID",
                r.role_name AS "RoleName",
                u.manager_id AS "ManagerID",
                u.department AS "Department",
                u.designation AS "Designation",
                u.is_active AS "IsActive",
                u.profile_image AS "ProfileImage",
                m.full_name AS "ManagerName"
            FROM tasktracker.users u
            JOIN tasktracker.roles r ON u.role_id = r.role_id
            LEFT JOIN tasktracker.users m ON u.manager_id = m.user_id
            WHERE LOWER(u.email) = LOWER($1)
            LIMIT 1
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = result.rows[0];
        if (!user.IsActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const today = getCurrentDateInTimeZone();

        await query(
            'UPDATE tasktracker.users SET last_login_at = NOW(), updated_at = NOW() WHERE user_id = $1',
            [user.UserID]
        );

        await query(`
            INSERT INTO tasktracker.daily_login_tracker (user_id, login_date, login_time)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id, login_date)
            DO UPDATE SET login_time = EXCLUDED.login_time
        `, [user.UserID, today]);

        const token = jwt.sign(
            {
                userId: user.UserID,
                employeeCode: user.EmployeeCode,
                email: user.Email,
                fullName: user.FullName,
                roleId: user.RoleID,
                roleName: user.RoleName,
                managerId: user.ManagerID,
                department: user.Department
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        res.json({
            success: true,
            message: 'Login successful.',
            data: {
                token,
                user: {
                    userId: user.UserID,
                    employeeCode: user.EmployeeCode,
                    fullName: user.FullName,
                    email: user.Email,
                    role: user.RoleName,
                    roleId: user.RoleID,
                    managerId: user.ManagerID,
                    managerName: user.ManagerName,
                    department: user.Department,
                    designation: user.Designation,
                    profileImage: user.ProfileImage
                }
            }
        });
    } catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getProfile = async (req, res) => {
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
                u.department AS "Department",
                u.designation AS "Designation",
                u.phone AS "Phone",
                u.is_active AS "IsActive",
                u.last_login_at AS "LastLoginAt",
                u.profile_image AS "ProfileImage",
                m.full_name AS "ManagerName"
            FROM tasktracker.users u
            JOIN tasktracker.roles r ON u.role_id = r.role_id
            LEFT JOIN tasktracker.users m ON u.manager_id = m.user_id
            WHERE u.user_id = $1
            LIMIT 1
        `, [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Auth] Profile error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userResult = await query(
            'SELECT password_hash AS "PasswordHash" FROM tasktracker.users WHERE user_id = $1 LIMIT 1',
            [req.user.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].PasswordHash);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hashedNew = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE tasktracker.users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
            [hashedNew, req.user.userId]
        );

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('[Auth] Change password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { login, getProfile, changePassword };
