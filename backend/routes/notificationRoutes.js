const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead, markSoundPlayed } = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/sound-played', markSoundPlayed);
router.put('/:id/read', markAsRead);

module.exports = router;