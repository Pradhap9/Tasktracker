// ============================================================
// TASK TRACKER - ENTERPRISE SERVER
// ============================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getPool } = require('./config/database');
const { startEscalationScheduler } = require('./services/escalationService');
const { runMigrations } = require('./utils/runMigrations');

// Route imports
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const managerRoutes = require('./routes/managerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const projectRoutes = require('./routes/projectRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- MIDDLEWARE ----
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://10.48.4.237:3000',
    'http://10.48.4.237:3001',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// ---- API ROUTES ----
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Task Tracker API is running', timestamp: new Date().toISOString() });
});

// Serve React frontend only when a local build exists.
const frontendBuildPath = path.join(__dirname, '../frontend/build');
const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

if (process.env.NODE_ENV === 'production' && fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendBuildPath));
    app.get('*', (req, res) => {
        res.sendFile(frontendIndexPath);
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'Task Tracker API is running',
            frontendServed: false,
            timestamp: new Date().toISOString()
        });
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ---- START SERVER ----
async function startServer() {
    try {
        // Test database connection
        await getPool();
        console.log('[Server] Database connection established');
        await runMigrations();

        // Start escalation scheduler
        startEscalationScheduler();

        app.listen(PORT, () => {
            console.log('====================================================');
            console.log(`  TASK TRACKER SERVER`);
            console.log(`  Port: ${PORT}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Frontend: ${process.env.FRONTEND_URL}`);
            console.log('====================================================');
        });
    } catch (err) {
        console.error('[Server] Failed to start:', err.message);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    const { closePool } = require('./config/database');
    await closePool();
    process.exit(0);
});
