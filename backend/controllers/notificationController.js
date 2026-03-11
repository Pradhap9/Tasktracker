const { query } = require('../config/database');

const getNotifications = async (req, res) => {
    try {
        const result = await query(`
            SELECT
                notification_id AS "NotificationID",
                user_id AS "UserID",
                title AS "Title",
                message AS "Message",
                notification_type AS "NotificationType",
                reference_type AS "ReferenceType",
                reference_id AS "ReferenceID",
                is_read AS "IsRead",
                is_sound_played AS "IsSoundPlayed",
                created_at AS "CreatedAt"
            FROM tasktracker.notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.userId]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[Notification] Get error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const result = await query(
            'SELECT COUNT(*)::int AS "Count" FROM tasktracker.notifications WHERE user_id = $1 AND is_read = FALSE',
            [req.user.userId]
        );

        res.json({ success: true, data: { count: result.rows[0].Count } });
    } catch (err) {
        console.error('[Notification] Count error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const markAsRead = async (req, res) => {
    try {
        await query(
            'UPDATE tasktracker.notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        res.json({ success: true, message: 'Marked as read.' });
    } catch (err) {
        console.error('[Notification] Mark read error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await query(
            'UPDATE tasktracker.notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
            [req.user.userId]
        );

        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        console.error('[Notification] Mark all read error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const markSoundPlayed = async (req, res) => {
    try {
        await query(
            'UPDATE tasktracker.notifications SET is_sound_played = TRUE WHERE user_id = $1 AND is_sound_played = FALSE',
            [req.user.userId]
        );

        res.json({ success: true, message: 'Sound played marked.' });
    } catch (err) {
        console.error('[Notification] Sound played error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, markSoundPlayed };
