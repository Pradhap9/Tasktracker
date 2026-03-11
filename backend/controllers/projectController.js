const { query } = require('../config/database');

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
            u.full_name AS "FullName",
            u.email AS "Email"
        FROM tasktracker.users u
        JOIN tasktracker.roles r ON u.role_id = r.role_id
        WHERE ${whereClause}
        LIMIT 1
    `, params);

    return result.rows[0] || null;
}

function getProjectVisibilityClause(currentUser) {
    if (currentUser.roleName === 'Admin') {
        return {
            clause: '',
            params: []
        };
    }

    if (currentUser.roleName === 'Manager') {
        return {
            clause: 'WHERE p.manager_id = $1 OR p.assigned_to = $1',
            params: [currentUser.userId]
        };
    }

    return {
        clause: 'WHERE p.assigned_to = $1',
        params: [currentUser.userId]
    };
}

const getProjects = async (req, res) => {
    try {
        const visibility = getProjectVisibilityClause(req.user);
        const result = await query(`
            SELECT
                p.project_id AS "ProjectID",
                p.project_name AS "ProjectName",
                p.description AS "Description",
                p.status AS "Status",
                p.priority AS "Priority",
                p.start_date AS "StartDate",
                p.end_date AS "EndDate",
                p.manager_id AS "ManagerID",
                p.assigned_to AS "AssignedTo",
                p.created_at AS "CreatedAt",
                p.updated_at AS "UpdatedAt",
                assignee.full_name AS "AssignedUserName",
                manager.full_name AS "ManagerName",
                COUNT(t.task_id) FILTER (WHERE t.status <> 'Completed')::int AS "OpenTaskCount"
            FROM tasktracker.projects p
            LEFT JOIN tasktracker.users assignee ON p.assigned_to = assignee.user_id
            LEFT JOIN tasktracker.users manager ON p.manager_id = manager.user_id
            LEFT JOIN tasktracker.tasks t ON p.project_id = t.project_id
            ${visibility.clause}
            GROUP BY
                p.project_id,
                assignee.full_name,
                manager.full_name
            ORDER BY p.created_at DESC
        `, visibility.params);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Project] Get projects error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const createProject = async (req, res) => {
    try {
        const { projectName, description, status, priority, startDate, endDate, assignedTo } = req.body;

        if (!projectName || !assignedTo) {
            return res.status(400).json({ success: false, message: 'Project name and assignee are required.' });
        }

        const assignee = await getAssignableUser(req.user, assignedTo);
        if (!assignee) {
            return res.status(403).json({ success: false, message: 'You can only assign projects to your active resource persons.' });
        }

        const result = await query(`
            INSERT INTO tasktracker.projects (
                project_name, description, status, priority, start_date, end_date, manager_id, assigned_to
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                project_id AS "ProjectID",
                project_name AS "ProjectName",
                description AS "Description",
                status AS "Status",
                priority AS "Priority",
                start_date AS "StartDate",
                end_date AS "EndDate",
                manager_id AS "ManagerID",
                assigned_to AS "AssignedTo",
                created_at AS "CreatedAt",
                updated_at AS "UpdatedAt"
        `, [
            projectName,
            description || null,
            status || 'Planned',
            priority || 'Medium',
            startDate || null,
            endDate || null,
            req.user.userId,
            assignedTo
        ]);

        await query(`
            INSERT INTO tasktracker.notifications (
                user_id, title, message, notification_type, reference_type, reference_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            assignedTo,
            'New Project Assigned',
            `${req.user.fullName} assigned you to project "${projectName}".`,
            'ProjectAssignment',
            'Project',
            result.rows[0].ProjectID
        ]);

        res.status(201).json({ success: true, message: 'Project assigned successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('[Project] Create project error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const updateProject = async (req, res) => {
    try {
        const { projectName, description, status, priority, startDate, endDate, assignedTo } = req.body;

        const currentProject = await query(`
            SELECT
                project_id AS "ProjectID",
                project_name AS "ProjectName",
                assigned_to AS "AssignedTo",
                manager_id AS "ManagerID"
            FROM tasktracker.projects
            WHERE project_id = $1
            LIMIT 1
        `, [req.params.id]);

        if (currentProject.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const project = currentProject.rows[0];
        if (req.user.roleName !== 'Admin' && project.ManagerID !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this project.' });
        }

        const assignee = await getAssignableUser(req.user, assignedTo);
        if (!assignee) {
            return res.status(403).json({ success: false, message: 'You can only assign projects to your active resource persons.' });
        }

        const result = await query(`
            UPDATE tasktracker.projects
            SET
                project_name = $1,
                description = $2,
                status = $3,
                priority = $4,
                start_date = $5,
                end_date = $6,
                assigned_to = $7,
                updated_at = NOW()
            WHERE project_id = $8
            RETURNING
                project_id AS "ProjectID",
                project_name AS "ProjectName",
                description AS "Description",
                status AS "Status",
                priority AS "Priority",
                start_date AS "StartDate",
                end_date AS "EndDate",
                manager_id AS "ManagerID",
                assigned_to AS "AssignedTo",
                created_at AS "CreatedAt",
                updated_at AS "UpdatedAt"
        `, [
            projectName,
            description || null,
            status || 'Planned',
            priority || 'Medium',
            startDate || null,
            endDate || null,
            assignedTo,
            req.params.id
        ]);

        if (project.AssignedTo !== assignedTo) {
            await query(`
                INSERT INTO tasktracker.notifications (
                    user_id, title, message, notification_type, reference_type, reference_id
                )
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                assignedTo,
                'Project Reassigned',
                `${req.user.fullName} assigned you to project "${projectName}".`,
                'ProjectAssignment',
                'Project',
                req.params.id
            ]);
        }

        res.json({ success: true, message: 'Project updated successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('[Project] Update project error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { getProjects, createProject, updateProject };
