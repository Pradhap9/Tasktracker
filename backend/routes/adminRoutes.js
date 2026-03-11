const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
    getAllUsers, createUser, updateUser, resetUserPassword, deleteUser,
    getManagers, getRoles, getEscalationConfig, updateEscalationConfig,
    getAdminDashboardStats, assignManagerToUser
} = require('../controllers/adminController');

router.use(authenticateToken, authorizeRoles('Admin'));

router.get('/dashboard-stats', getAdminDashboardStats);
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.put('/users/:id/reset-password', resetUserPassword);
router.delete('/users/:id', deleteUser);
router.get('/managers', getManagers);
router.get('/roles', getRoles);
router.post('/assign-manager', assignManagerToUser);
router.get('/escalation-config', getEscalationConfig);
router.put('/escalation-config/:key', updateEscalationConfig);

module.exports = router;
