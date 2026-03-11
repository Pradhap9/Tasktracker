const { query } = require('../config/database');

const statements = [
    `CREATE TABLE IF NOT EXISTS tasktracker.projects (
        project_id BIGSERIAL PRIMARY KEY,
        project_name VARCHAR(150) NOT NULL,
        description TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'Planned',
        priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
        start_date DATE,
        end_date DATE,
        manager_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
        assigned_to BIGINT REFERENCES tasktracker.users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE tasktracker.tasks
        ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES tasktracker.projects(project_id) ON DELETE SET NULL`,
    `ALTER TABLE tasktracker.tasks
        ADD COLUMN IF NOT EXISTS assigned_by BIGINT REFERENCES tasktracker.users(user_id) ON DELETE SET NULL`,
    `ALTER TABLE tasktracker.tasks
        ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON tasktracker.projects (manager_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON tasktracker.projects (assigned_to, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasktracker.tasks (project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasktracker.tasks (assigned_by)`,
    `INSERT INTO tasktracker.escalation_config (config_key, config_value, description)
     VALUES ('NOTIFICATION_SOUND_ENABLED', 'true', 'Play a sound when new notifications arrive')
     ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = EXCLUDED.description`
];

async function runMigrations() {
    for (const statement of statements) {
        await query(statement);
    }
    console.log('[DB] Migrations applied');
}

module.exports = { runMigrations };
