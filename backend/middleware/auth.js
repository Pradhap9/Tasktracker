// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.roleName)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action.'
            });
        }
        next();
    };
};

const authorizeManagerOrAdmin = (req, res, next) => {
    if (!req.user || !['Admin', 'Manager'].includes(req.user.roleName)) {
        return res.status(403).json({
            success: false,
            message: 'Manager or Admin access required.'
        });
    }
    next();
};

module.exports = { authenticateToken, authorizeRoles, authorizeManagerOrAdmin };
