const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeManagerOrAdmin } = require('../middleware/auth');
const {
    getTeamMembers, getTeamTasks, approveTask, approveHours,
    getEscalations, dismissEscalation, exportTeamData, getManagerDashboardStats
} = require('../controllers/managerController');

router.use(authenticateToken, authorizeManagerOrAdmin);

router.get('/dashboard-stats', getManagerDashboardStats);
router.get('/team', getTeamMembers);
router.get('/team-tasks', getTeamTasks);
router.put('/approve-task/:taskId', approveTask);
router.put('/approve-hours/:taskId', approveHours);
router.get('/escalations', getEscalations);
router.put('/escalations/:id/dismiss', dismissEscalation);
router.get('/export/:format', exportTeamData);

module.exports = router;
