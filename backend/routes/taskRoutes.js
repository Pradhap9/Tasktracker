const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    createTask, getTasks, getTaskById, updateTask, deleteTask,
    getDashboardStats, getCategories, getSubmissionWindow
} = require('../controllers/taskController');

router.use(authenticateToken);

router.get('/categories', getCategories);
router.get('/dashboard/stats', getDashboardStats);
router.get('/config/submission-window', getSubmissionWindow);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;