const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const { query } = require('../config/database');
const { getCurrentDateInTimeZone } = require('../utils/time');

async function getAssignableUser(currentUser, targetUserId) {
    const params = [targetUserId];
    let whereClause = `
        u.user_id = $1
        AND u.is_active = TRUE
        AND r.role_name = 'User'
    `;

    if (currentUser.roleName !== 'Admin') {
        params.push(currentUser.userId);
        whereClause += ` AND u.manager_id = $2`;
    }

    const result = await query(`
        SELECT
            u.user_id AS "UserID",
            u.full_name AS "FullName"
        FROM tasktracker.users u
        JOIN tasktracker.roles r ON u.role_id = r.role_id
        WHERE ${whereClause}
        LIMIT 1
    `, params);

    return result.rows[0] || null;
}

function buildManagerTaskFilters(managerId, filters) {
    const params = [managerId];
    const clauses = ['u.manager_id = $1'];

    const add = (value, clauseBuilder) => {
        params.push(value);
        clauses.push(clauseBuilder(`$${params.length}`));
    };

    if (filters.startDate) add(filters.startDate, (p) => `t.task_date >= ${p}`);
    if (filters.endDate) add(filters.endDate, (p) => `t.task_date <= ${p}`);
    if (filters.userId) add(filters.userId, (p) => `t.user_id = ${p}`);
    if (filters.status) add(filters.status, (p) => `t.approval_status = ${p}`);

    return { params, whereClause: `WHERE ${clauses.join(' AND ')}` };
}

const getTeamMembers = async (req, res) => {
    try {
        const today = getCurrentDateInTimeZone();
        const result = await query(`
            SELECT
                u.user_id AS "UserID",
                u.employee_code AS "EmployeeCode",
                u.full_name AS "FullName",
                u.email AS "Email",
                u.department AS "Department",
                u.designation AS "Designation",
                u.phone AS "Phone",
                u.is_active AS "IsActive",
                u.last_login_at AS "LastLoginAt",
                (
                    SELECT COUNT(*)::int
                    FROM tasktracker.tasks t
                    WHERE t.user_id = u.user_id AND t.task_date = $2
                ) AS "TodayTaskCount",
                (
                    SELECT COALESCE(SUM(t.actual_hours), 0)
                    FROM tasktracker.tasks t
                    WHERE t.user_id = u.user_id AND t.task_date = $2
                ) AS "TodayHours"
            FROM tasktracker.users u
            WHERE u.manager_id = $1 AND u.is_active = TRUE
            ORDER BY u.full_name
        `, [req.user.userId, today]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Manager] Team error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getTeamTasks = async (req, res) => {
    try {
        const { startDate, endDate, userId, status, page = 1, limit = 50 } = req.query;
        const pageNumber = Number(page) || 1;
        const pageSize = Number(limit) || 50;
        const offset = (pageNumber - 1) * pageSize;
        const { params, whereClause } = buildManagerTaskFilters(req.user.userId, { startDate, endDate, userId, status });

        const result = await query(`
            SELECT
                t.task_id AS "TaskID",
                t.user_id AS "UserID",
                t.category_id AS "CategoryID",
                t.task_date AS "TaskDate",
                t.task_title AS "TaskTitle",
                t.task_description AS "TaskDescription",
                t.planned_hours AS "PlannedHours",
                t.actual_hours AS "ActualHours",
                t.priority AS "Priority",
                t.status AS "Status",
                t.approval_status AS "ApprovalStatus",
                t.hours_approval_status AS "HoursApprovalStatus",
                t.due_date AS "DueDate",
                t.submitted_at AS "SubmittedAt",
                t.assigned_by AS "AssignedBy",
                u.full_name AS "UserName",
                u.employee_code AS "EmployeeCode",
                c.category_name AS "CategoryName",
                c.color_code AS "ColorCode",
                p.project_name AS "ProjectName",
                assigner.full_name AS "AssignedByName"
            FROM tasktracker.tasks t
            JOIN tasktracker.users u ON t.user_id = u.user_id
            LEFT JOIN tasktracker.task_categories c ON t.category_id = c.category_id
            LEFT JOIN tasktracker.projects p ON t.project_id = p.project_id
            LEFT JOIN tasktracker.users assigner ON t.assigned_by = assigner.user_id
            ${whereClause}
            ORDER BY t.task_date DESC, t.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, pageSize, offset]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Manager] Team tasks error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const approveTask = async (req, res) => {
    try {
        const { approvalStatus, comments } = req.body;
        const verifyResult = await query(`
            SELECT
                t.task_id AS "TaskID",
                t.user_id AS "UserID",
                t.task_title AS "TaskTitle"
            FROM tasktracker.tasks t
            JOIN tasktracker.users u ON t.user_id = u.user_id
            WHERE t.task_id = $1 AND u.manager_id = $2
            LIMIT 1
        `, [req.params.taskId, req.user.userId]);

        if (verifyResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not authorized to approve this task.' });
        }

        await query(`
            UPDATE tasktracker.tasks
            SET
                approval_status = $1,
                approved_by = $2,
                approval_date = NOW(),
                approval_comments = $3,
                updated_at = NOW()
            WHERE task_id = $4
        `, [approvalStatus, req.user.userId, comments || null, req.params.taskId]);

        const task = verifyResult.rows[0];
        await query(`
            INSERT INTO tasktracker.notifications (
                user_id, title, message, notification_type, reference_type, reference_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            task.UserID,
            `Task ${approvalStatus}`,
            `Your task "${task.TaskTitle}" has been ${approvalStatus.toLowerCase()} by ${req.user.fullName}`,
            'Approval',
            'Task',
            task.TaskID
        ]);

        res.json({ success: true, message: `Task ${approvalStatus.toLowerCase()} successfully.` });
    } catch (err) {
        console.error('[Manager] Approve error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const assignTaskToResource = async (req, res) => {
    try {
        const {
            userId, projectId, categoryId, taskDate, taskTitle,
            taskDescription, plannedHours, priority, dueDate
        } = req.body;

        if (!userId || !taskTitle || !taskDate) {
            return res.status(400).json({ success: false, message: 'Assignee, task title, and task date are required.' });
        }

        const assignee = await getAssignableUser(req.user, userId);
        if (!assignee) {
            return res.status(403).json({ success: false, message: 'You can only assign tasks to your active resource persons.' });
        }

        if (projectId) {
            const projectParams = [projectId];
            let projectWhere = 'project_id = $1';
            if (req.user.roleName !== 'Admin') {
                projectParams.push(req.user.userId);
                projectWhere += ' AND manager_id = $2';
            }

            const projectResult = await query(`
                SELECT project_id AS "ProjectID"
                FROM tasktracker.projects
                WHERE ${projectWhere}
                LIMIT 1
            `, projectParams);

            if (projectResult.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'You can only assign tasks within projects you manage.' });
            }
        }

        const result = await query(`
            INSERT INTO tasktracker.tasks (
                user_id, category_id, project_id, task_date, task_title, task_description,
                planned_hours, actual_hours, priority, status, approval_status,
                approved_by, approval_date, approval_comments, due_date, assigned_by, assigned_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 'Pending', 'Approved', $9, NOW(), 'Assigned by manager', $10, $9, NOW())
            RETURNING task_id AS "TaskID"
        `, [
            userId,
            categoryId || null,
            projectId || null,
            taskDate,
            taskTitle,
            taskDescription || null,
            Number(plannedHours || 0),
            priority || 'Medium',
            req.user.userId,
            dueDate || null
        ]);

        await query(`
            INSERT INTO tasktracker.notifications (
                user_id, title, message, notification_type, reference_type, reference_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            userId,
            'New Task Assigned',
            `${req.user.fullName} assigned you a task: "${taskTitle}".`,
            'TaskAssignment',
            'Task',
            result.rows[0].TaskID
        ]);

        res.status(201).json({ success: true, message: 'Task assigned successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('[Manager] Assign task error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const approveHours = async (req, res) => {
    try {
        const { hoursApprovalStatus } = req.body;
        const verifyResult = await query(`
            SELECT t.task_id
            FROM tasktracker.tasks t
            JOIN tasktracker.users u ON t.user_id = u.user_id
            WHERE t.task_id = $1 AND u.manager_id = $2
            LIMIT 1
        `, [req.params.taskId, req.user.userId]);

        if (verifyResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not authorized to approve task hours.' });
        }

        await query(`
            UPDATE tasktracker.tasks
            SET
                hours_approval_status = $1,
                hours_approved_by = $2,
                hours_approval_date = NOW(),
                updated_at = NOW()
            WHERE task_id = $3
        `, [hoursApprovalStatus, req.user.userId, req.params.taskId]);

        res.json({ success: true, message: `Hours ${hoursApprovalStatus.toLowerCase()}.` });
    } catch (err) {
        console.error('[Manager] Hours approval error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getEscalations = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                e.escalation_id AS "EscalationID",
                e.user_id AS "UserID",
                e.manager_id AS "ManagerID",
                e.escalation_date AS "EscalationDate",
                e.message AS "Message",
                e.is_dismissed AS "IsDismissed",
                e.is_read AS "IsRead",
                e.created_at AS "CreatedAt",
                u.full_name AS "UserName",
                u.employee_code AS "EmployeeCode",
                u.email AS "UserEmail"
            FROM tasktracker.escalation_log e
            JOIN tasktracker.users u ON e.user_id = u.user_id
            WHERE e.manager_id = $1
            ORDER BY e.created_at DESC
        `, [req.user.userId]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Manager] Escalations error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const dismissEscalation = async (req, res) => {
    try {
        await query(`
            UPDATE tasktracker.escalation_log
            SET is_dismissed = TRUE, is_read = TRUE
            WHERE escalation_id = $1 AND manager_id = $2
        `, [req.params.id, req.user.userId]);

        res.json({ success: true, message: 'Escalation dismissed.' });
    } catch (err) {
        console.error('[Manager] Dismiss error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const exportTeamData = async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate, userId } = req.query;
        const { params, whereClause } = buildManagerTaskFilters(req.user.userId, { startDate, endDate, userId });

        const result = await query(`
            SELECT
                u.employee_code AS "EmployeeCode",
                u.full_name AS "FullName",
                u.email AS "Email",
                u.department AS "Department",
                u.designation AS "Designation",
                t.task_date AS "TaskDate",
                t.task_title AS "TaskTitle",
                t.task_description AS "TaskDescription",
                c.category_name AS "CategoryName",
                p.project_name AS "ProjectName",
                t.planned_hours AS "PlannedHours",
                t.actual_hours AS "ActualHours",
                t.priority AS "Priority",
                t.status AS "Status",
                t.approval_status AS "ApprovalStatus",
                t.hours_approval_status AS "HoursApprovalStatus",
                t.submitted_at AS "SubmittedAt"
            FROM tasktracker.tasks t
            JOIN tasktracker.users u ON t.user_id = u.user_id
            LEFT JOIN tasktracker.task_categories c ON t.category_id = c.category_id
            LEFT JOIN tasktracker.projects p ON t.project_id = p.project_id
            ${whereClause}
            ORDER BY u.full_name, t.task_date DESC
        `, params);

        if (format === 'csv') {
            const parser = new Parser({
                fields: [
                    'EmployeeCode', 'FullName', 'Email', 'Department', 'Designation',
                    'TaskDate', 'TaskTitle', 'CategoryName', 'PlannedHours', 'ActualHours',
                    'Priority', 'Status', 'ApprovalStatus', 'HoursApprovalStatus'
                ]
            });
            const csv = parser.parse(result.rows);
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename=team_tasks_report.csv');
            return res.send(csv);
        }

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Team Tasks');

            sheet.columns = [
                { header: 'Employee Code', key: 'EmployeeCode', width: 15 },
                { header: 'Full Name', key: 'FullName', width: 25 },
                { header: 'Email', key: 'Email', width: 30 },
                { header: 'Department', key: 'Department', width: 18 },
                { header: 'Task Date', key: 'TaskDate', width: 14 },
                { header: 'Task Title', key: 'TaskTitle', width: 40 },
                { header: 'Category', key: 'CategoryName', width: 18 },
                { header: 'Planned Hrs', key: 'PlannedHours', width: 12 },
                { header: 'Actual Hrs', key: 'ActualHours', width: 12 },
                { header: 'Priority', key: 'Priority', width: 12 },
                { header: 'Status', key: 'Status', width: 15 },
                { header: 'Approval', key: 'ApprovalStatus', width: 15 },
                { header: 'Hours Approval', key: 'HoursApprovalStatus', width: 15 }
            ];

            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };

            result.rows.forEach((row) => {
                sheet.addRow(row);
            });

            res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.header('Content-Disposition', 'attachment; filename=team_tasks_report.xlsx');
            await workbook.xlsx.write(res);
            return res.end();
        }

        return res.status(400).json({ success: false, message: 'Invalid format. Use "csv" or "excel".' });
    } catch (err) {
        console.error('[Manager] Export error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getManagerDashboardStats = async (req, res) => {
    try {
        const today = getCurrentDateInTimeZone();
        const result = await query(`
            SELECT
                (SELECT COUNT(*)::int FROM tasktracker.users WHERE manager_id = $1 AND is_active = TRUE) AS "TotalTeamMembers",
                (
                    SELECT COUNT(DISTINCT t.user_id)::int
                    FROM tasktracker.tasks t
                    JOIN tasktracker.users u ON t.user_id = u.user_id
                    WHERE u.manager_id = $1 AND t.task_date = $2
                ) AS "MembersSubmittedToday",
                (
                    SELECT COUNT(*)::int
                    FROM tasktracker.tasks t
                    JOIN tasktracker.users u ON t.user_id = u.user_id
                    WHERE u.manager_id = $1 AND t.approval_status = 'Pending'
                ) AS "PendingApprovals",
                (
                    SELECT COUNT(*)::int
                    FROM tasktracker.escalation_log
                    WHERE manager_id = $1 AND escalation_date = $2 AND is_dismissed = FALSE
                ) AS "TodayEscalations",
                (
                    SELECT COALESCE(SUM(t.actual_hours), 0)
                    FROM tasktracker.tasks t
                    JOIN tasktracker.users u ON t.user_id = u.user_id
                    WHERE u.manager_id = $1 AND t.task_date = $2
                ) AS "TotalTeamHoursToday"
        `, [req.user.userId, today]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Manager] Dashboard stats error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = {
    getTeamMembers, getTeamTasks, approveTask, assignTaskToResource, approveHours,
    getEscalations, dismissEscalation, exportTeamData, getManagerDashboardStats
};
