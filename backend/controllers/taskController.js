const { query } = require('../config/database');
const { getCurrentDateInTimeZone, getWeekBounds } = require('../utils/time');

async function validateProjectAccess(projectId, currentUser) {
    if (!projectId) return true;

    const params = [projectId];
    let whereClause = 'project_id = $1';

    if (currentUser.roleName === 'Admin') {
        whereClause += '';
    } else if (currentUser.roleName === 'Manager') {
        params.push(currentUser.userId);
        whereClause += ' AND (manager_id = $2 OR assigned_to = $2)';
    } else {
        params.push(currentUser.userId);
        whereClause += ' AND assigned_to = $2';
    }

    const result = await query(`
        SELECT project_id AS "ProjectID"
        FROM tasktracker.projects
        WHERE ${whereClause}
        LIMIT 1
    `, params);

    return result.rows.length > 0;
}

function buildTaskFilters(baseQuery, filters) {
    const clauses = [];
    const params = [];

    const add = (value, clauseBuilder) => {
        params.push(value);
        clauses.push(clauseBuilder(`$${params.length}`));
    };

    if (filters.userId !== undefined) add(filters.userId, (p) => `t.user_id = ${p}`);
    if (filters.startDate) add(filters.startDate, (p) => `t.task_date >= ${p}`);
    if (filters.endDate) add(filters.endDate, (p) => `t.task_date <= ${p}`);
    if (filters.status) add(filters.status, (p) => `t.status = ${p}`);
    if (filters.approvalStatus) add(filters.approvalStatus, (p) => `t.approval_status = ${p}`);
    if (filters.projectId) add(filters.projectId, (p) => `t.project_id = ${p}`);

    return {
        text: `${baseQuery}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`,
        params
    };
}

const selectTaskColumns = `
    SELECT
        t.task_id AS "TaskID",
        t.user_id AS "UserID",
        t.category_id AS "CategoryID",
        t.project_id AS "ProjectID",
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
        t.approved_by AS "ApprovedBy",
        t.approval_date AS "ApprovalDate",
        t.approval_comments AS "ApprovalComments",
        t.hours_approved_by AS "HoursApprovedBy",
        t.hours_approval_date AS "HoursApprovalDate",
        t.submitted_at AS "SubmittedAt",
        t.completed_at AS "CompletedAt",
        t.created_at AS "CreatedAt",
        t.updated_at AS "UpdatedAt",
        c.category_name AS "CategoryName",
        c.color_code AS "ColorCode",
        p.project_name AS "ProjectName",
        approver.full_name AS "ApproverName",
        hours_approver.full_name AS "HoursApproverName",
        assigner.full_name AS "AssignedByName",
        t.assigned_by AS "AssignedBy",
        t.assigned_at AS "AssignedAt"
    FROM tasktracker.tasks t
    LEFT JOIN tasktracker.task_categories c ON t.category_id = c.category_id
    LEFT JOIN tasktracker.projects p ON t.project_id = p.project_id
    LEFT JOIN tasktracker.users approver ON t.approved_by = approver.user_id
    LEFT JOIN tasktracker.users hours_approver ON t.hours_approved_by = hours_approver.user_id
    LEFT JOIN tasktracker.users assigner ON t.assigned_by = assigner.user_id
`;

const createTask = async (req, res) => {
    try {
        const {
            categoryId, projectId, taskDate, taskTitle, taskDescription,
            plannedHours, actualHours, priority, dueDate
        } = req.body;
        const userId = req.user.userId;

        if (!taskTitle || !taskDate) {
            return res.status(400).json({ success: false, message: 'Task title and date are required.' });
        }

        const hasProjectAccess = await validateProjectAccess(projectId, req.user);
        if (!hasProjectAccess) {
            return res.status(403).json({ success: false, message: 'Not authorized to use this project.' });
        }

        const result = await query(`
            INSERT INTO tasktracker.tasks (
                user_id, category_id, project_id, task_date, task_title, task_description,
                planned_hours, actual_hours, priority, due_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING
                task_id AS "TaskID",
                user_id AS "UserID",
                category_id AS "CategoryID",
                project_id AS "ProjectID",
                task_date AS "TaskDate",
                task_title AS "TaskTitle",
                task_description AS "TaskDescription",
                planned_hours AS "PlannedHours",
                actual_hours AS "ActualHours",
                priority AS "Priority",
                due_date AS "DueDate",
                status AS "Status",
                approval_status AS "ApprovalStatus",
                hours_approval_status AS "HoursApprovalStatus",
                submitted_at AS "SubmittedAt",
                created_at AS "CreatedAt",
                updated_at AS "UpdatedAt"
        `, [
            userId,
            categoryId || null,
            projectId || null,
            taskDate,
            taskTitle,
            taskDescription || null,
            Number(plannedHours || 0),
            Number(actualHours || 0),
            priority || 'Medium',
            dueDate || null
        ]);

        const today = getCurrentDateInTimeZone();
        await query(`
            INSERT INTO tasktracker.daily_login_tracker (
                user_id, login_date, login_time, has_submitted_task, task_submission_time
            )
            VALUES ($1, $2, NOW(), TRUE, NOW())
            ON CONFLICT (user_id, login_date)
            DO UPDATE SET
                has_submitted_task = TRUE,
                task_submission_time = NOW()
        `, [userId, today]);

        const managerResult = await query(
            'SELECT manager_id AS "ManagerID" FROM tasktracker.users WHERE user_id = $1 AND manager_id IS NOT NULL LIMIT 1',
            [userId]
        );

        if (managerResult.rows.length > 0 && managerResult.rows[0].ManagerID) {
            await query(`
                INSERT INTO tasktracker.notifications (
                    user_id, title, message, notification_type, reference_type, reference_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                managerResult.rows[0].ManagerID,
                'New Task Submitted',
                `${req.user.fullName} submitted a new task: ${taskTitle}`,
                'TaskSubmission',
                'Task',
                result.rows[0].TaskID
            ]);
        }

        res.status(201).json({ success: true, message: 'Task created successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('[Task] Create error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getTasks = async (req, res) => {
    try {
        const {
            startDate, endDate, status, approvalStatus, projectId,
            page = 1, limit = 50
        } = req.query;

        const pageNumber = Number(page) || 1;
        const pageSize = Number(limit) || 50;
        const offset = (pageNumber - 1) * pageSize;

        const base = buildTaskFilters(selectTaskColumns, {
            userId: req.user.userId,
            startDate,
            endDate,
            status,
            approvalStatus,
            projectId
        });

        const taskResult = await query(
            `${base.text} ORDER BY t.task_date DESC, t.created_at DESC LIMIT $${base.params.length + 1} OFFSET $${base.params.length + 2}`,
            [...base.params, pageSize, offset]
        );

        const countBase = buildTaskFilters(
            'SELECT COUNT(*)::int AS "Total" FROM tasktracker.tasks t',
            { userId: req.user.userId, startDate, endDate, status, approvalStatus, projectId }
        );
        const countResult = await query(countBase.text, countBase.params);

        res.json({
            success: true,
            data: taskResult.rows,
            pagination: {
                total: countResult.rows[0].Total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(countResult.rows[0].Total / pageSize)
            }
        });
    } catch (err) {
        console.error('[Task] Get error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getTaskById = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                t.task_id AS "TaskID",
                t.user_id AS "UserID",
                t.category_id AS "CategoryID",
                t.project_id AS "ProjectID",
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
                c.category_name AS "CategoryName",
                c.color_code AS "ColorCode",
                u.full_name AS "UserName",
                p.project_name AS "ProjectName",
                t.assigned_by AS "AssignedBy",
                assigner.full_name AS "AssignedByName"
            FROM tasktracker.tasks t
            LEFT JOIN tasktracker.task_categories c ON t.category_id = c.category_id
            LEFT JOIN tasktracker.projects p ON t.project_id = p.project_id
            JOIN tasktracker.users u ON t.user_id = u.user_id
            LEFT JOIN tasktracker.users assigner ON t.assigned_by = assigner.user_id
            WHERE t.task_id = $1 AND t.user_id = $2
            LIMIT 1
        `, [req.params.id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Task] GetById error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const updateTask = async (req, res) => {
    try {
        const {
            categoryId, projectId, taskTitle, taskDescription,
            plannedHours, actualHours, priority,
            status, dueDate, taskDate
        } = req.body;

        const hasProjectAccess = await validateProjectAccess(projectId, req.user);
        if (!hasProjectAccess) {
            return res.status(403).json({ success: false, message: 'Not authorized to use this project.' });
        }

        await query(`
            UPDATE tasktracker.tasks
            SET
                category_id = $1,
                project_id = $2,
                task_title = $3,
                task_description = $4,
                planned_hours = $5,
                actual_hours = $6,
                priority = $7,
                status = $8,
                due_date = $9,
                task_date = COALESCE($10, task_date),
                updated_at = NOW(),
                completed_at = CASE
                    WHEN $8 = 'Completed' AND completed_at IS NULL THEN NOW()
                    WHEN $8 <> 'Completed' THEN NULL
                    ELSE completed_at
                END
            WHERE task_id = $11 AND user_id = $12
        `, [
            categoryId || null,
            projectId || null,
            taskTitle,
            taskDescription || null,
            Number(plannedHours || 0),
            Number(actualHours || 0),
            priority || 'Medium',
            status || 'Pending',
            dueDate || null,
            taskDate || null,
            req.params.id,
            req.user.userId
        ]);

        res.json({ success: true, message: 'Task updated successfully.' });
    } catch (err) {
        console.error('[Task] Update error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const deleteTask = async (req, res) => {
    try {
        await query(`
            DELETE FROM tasktracker.tasks
            WHERE task_id = $1 AND user_id = $2 AND approval_status = 'Pending' AND assigned_by IS NULL
        `, [req.params.id, req.user.userId]);

        res.json({ success: true, message: 'Task deleted.' });
    } catch (err) {
        console.error('[Task] Delete error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const today = getCurrentDateInTimeZone();
        const { weekStart, weekEnd } = getWeekBounds(today);
        const result = await query(`
            SELECT
                COUNT(*) FILTER (WHERE task_date = $2)::int AS "TodayTasks",
                COALESCE(SUM(actual_hours) FILTER (WHERE task_date = $2), 0) AS "TodayHours",
                COUNT(*) FILTER (WHERE task_date BETWEEN $3 AND $4)::int AS "WeekTasks",
                COUNT(*) FILTER (WHERE approval_status = 'Pending')::int AS "PendingApprovals"
            FROM tasktracker.tasks
            WHERE user_id = $1
        `, [req.user.userId, today, weekStart, weekEnd]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[Task] Dashboard error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getCategories = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                category_id AS "CategoryID",
                category_name AS "CategoryName",
                color_code AS "ColorCode",
                is_active AS "IsActive"
            FROM tasktracker.task_categories
            WHERE is_active = TRUE
            ORDER BY category_name
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Task] Categories error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getSubmissionWindow = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                config_key AS "ConfigKey",
                config_value AS "ConfigValue"
            FROM tasktracker.escalation_config
            WHERE config_key IN ('TASK_WINDOW_START', 'TASK_WINDOW_END', 'ESCALATION_TRIGGER_TIME')
        `);

        const config = {};
        result.rows.forEach((row) => {
            config[row.ConfigKey] = row.ConfigValue;
        });

        res.json({ success: true, data: config });
    } catch (err) {
        console.error('[Task] Config error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = {
    createTask, getTasks, getTaskById, updateTask, deleteTask,
    getDashboardStats, getCategories, getSubmissionWindow
};
