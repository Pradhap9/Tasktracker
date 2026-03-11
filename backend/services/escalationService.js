const cron = require('node-cron');
const { query, withTransaction } = require('../config/database');
const {
    getCurrentDateInTimeZone,
    getCurrentTimeInTimeZone,
    isWeekdayInTimeZone
} = require('../utils/time');

async function getEscalationConfig() {
    try {
        const result = await query(`
            SELECT
                config_key AS "ConfigKey",
                config_value AS "ConfigValue"
            FROM tasktracker.escalation_config
        `);

        const config = {};
        result.rows.forEach((row) => {
            config[row.ConfigKey] = row.ConfigValue;
        });
        return config;
    } catch (err) {
        console.error('[Escalation] Failed to load config from DB:', err.message);
        return null;
    }
}

function normalizeTime(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length !== 2) return null;
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

async function checkAndTriggerEscalations() {
    try {
        console.log('[Escalation] Running escalation check at', new Date().toISOString());
        const today = getCurrentDateInTimeZone();

        const pendingUsers = await query(`
            SELECT
                u.user_id AS "UserID",
                u.manager_id AS "ManagerID",
                u.full_name AS "FullName",
                u.employee_code AS "EmployeeCode"
            FROM tasktracker.users u
            JOIN tasktracker.roles r ON u.role_id = r.role_id
            WHERE
                u.is_active = TRUE
                AND u.manager_id IS NOT NULL
                AND r.role_name = 'User'
                AND NOT EXISTS (
                    SELECT 1
                    FROM tasktracker.tasks t
                    WHERE t.user_id = u.user_id AND t.task_date = $1
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM tasktracker.escalation_log e
                    WHERE e.user_id = u.user_id AND e.escalation_date = $1
                )
        `, [today]);

        if (pendingUsers.rows.length === 0) {
            console.log('[Escalation] 0 escalation(s) triggered.');
            return 0;
        }

        await withTransaction(async (client) => {
            for (const user of pendingUsers.rows) {
                const message = `${user.FullName} has not submitted tasks for ${today}.`;
                const escalationResult = await client.query(`
                    INSERT INTO tasktracker.escalation_log (
                        user_id, manager_id, escalation_date, message
                    )
                    VALUES ($1, $2, $3, $4)
                    RETURNING escalation_id AS "EscalationID"
                `, [user.UserID, user.ManagerID, today, message]);

                await client.query(`
                    INSERT INTO tasktracker.notifications (
                        user_id, title, message, notification_type, reference_type, reference_id
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    user.ManagerID,
                    'Task Escalation',
                    message,
                    'Escalation',
                    'Escalation',
                    escalationResult.rows[0].EscalationID
                ]);
            }
        });

        console.log(`[Escalation] ${pendingUsers.rows.length} escalation(s) triggered.`);
        return pendingUsers.rows.length;
    } catch (err) {
        console.error('[Escalation] Error running escalation:', err.message);
        return 0;
    }
}

async function dynamicEscalationCheck() {
    try {
        if (!isWeekdayInTimeZone()) return;

        const config = await getEscalationConfig();
        if (!config) return;

        const isEnabled = config.ESCALATION_ENABLED;
        if (!isEnabled || isEnabled.toLowerCase() !== 'true') {
            return;
        }

        const triggerTime = normalizeTime(config.ESCALATION_TRIGGER_TIME);
        const currentTime = getCurrentTimeInTimeZone();

        if (!triggerTime) {
            console.warn('[Escalation] ESCALATION_TRIGGER_TIME not set in DB');
            return;
        }

        console.log(`[Escalation] Current: ${currentTime} | Trigger: ${triggerTime}`);

        if (currentTime === triggerTime) {
            console.log('[Escalation] Trigger time matched. Running escalation...');
            await checkAndTriggerEscalations();
        }
    } catch (err) {
        console.error('[Escalation] Dynamic check error:', err.message);
    }
}

function startEscalationScheduler() {
    cron.schedule('* * * * *', async () => {
        await dynamicEscalationCheck();
    }, {
        timezone: 'Asia/Kolkata'
    });

    console.log('[Escalation] Dynamic scheduler started. Checks DB config every minute.');
}

module.exports = { startEscalationScheduler, checkAndTriggerEscalations, getEscalationConfig };
