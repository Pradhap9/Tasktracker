CREATE SCHEMA IF NOT EXISTS tasktracker;

CREATE TABLE IF NOT EXISTS tasktracker.roles (
    role_id INTEGER PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tasktracker.users (
    user_id BIGSERIAL PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES tasktracker.roles(role_id),
    manager_id BIGINT REFERENCES tasktracker.users(user_id) ON DELETE SET NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    profile_image TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasktracker.task_categories (
    category_id BIGSERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    color_code VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasktracker.tasks (
    task_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES tasktracker.task_categories(category_id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    planned_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    actual_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    approval_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    hours_approval_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    due_date DATE,
    approved_by BIGINT REFERENCES tasktracker.users(user_id) ON DELETE SET NULL,
    approval_date TIMESTAMPTZ,
    approval_comments TEXT,
    hours_approved_by BIGINT REFERENCES tasktracker.users(user_id) ON DELETE SET NULL,
    hours_approval_date TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasktracker.daily_login_tracker (
    daily_login_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
    login_date DATE NOT NULL,
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    has_submitted_task BOOLEAN NOT NULL DEFAULT FALSE,
    task_submission_time TIMESTAMPTZ,
    UNIQUE (user_id, login_date)
);

CREATE TABLE IF NOT EXISTS tasktracker.notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_sound_played BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasktracker.escalation_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(100) NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasktracker.escalation_log (
    escalation_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
    manager_id BIGINT NOT NULL REFERENCES tasktracker.users(user_id) ON DELETE CASCADE,
    escalation_date DATE NOT NULL,
    message TEXT NOT NULL,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, escalation_date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasktracker.tasks (user_id, task_date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_approval_status ON tasktracker.tasks (approval_status);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON tasktracker.users (manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON tasktracker.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_log_manager_date ON tasktracker.escalation_log (manager_id, escalation_date DESC);

INSERT INTO tasktracker.roles (role_id, role_name)
VALUES
    (1, 'Admin'),
    (2, 'Manager'),
    (3, 'User')
ON CONFLICT (role_id) DO UPDATE SET role_name = EXCLUDED.role_name;

INSERT INTO tasktracker.task_categories (category_name, color_code)
VALUES
    ('Development', '#2563eb'),
    ('Testing', '#16a34a'),
    ('Meeting', '#f59e0b'),
    ('Support', '#ef4444'),
    ('Documentation', '#7c3aed')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO tasktracker.escalation_config (config_key, config_value, description)
VALUES
    ('ESCALATION_ENABLED', 'true', 'Enable or disable automatic escalation notifications'),
    ('TASK_WINDOW_START', '09:00', 'Task submission start time in IST'),
    ('TASK_WINDOW_END', '11:00', 'Task submission end time in IST'),
    ('ESCALATION_TRIGGER_TIME', '11:01', 'Escalation trigger time in IST')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description;
