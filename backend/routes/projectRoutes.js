const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeManagerOrAdmin } = require('../middleware/auth');
const { getProjects, createProject, updateProject } = require('../controllers/projectController');

router.use(authenticateToken);

router.get('/', getProjects);
router.post('/', authorizeManagerOrAdmin, createProject);
router.put('/:id', authorizeManagerOrAdmin, updateProject);

module.exports = router;
