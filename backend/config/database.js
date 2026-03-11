const { Pool, types } = require('pg');
require('dotenv').config();

types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)));
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));

let pool = null;
let connectPromise = null;

function getSslConfig() {
    return String(process.env.DB_SSL || 'true').toLowerCase() === 'false'
        ? false
        : { rejectUnauthorized: false };
}

function buildConfig() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required. Use your Neon PostgreSQL connection string.');
    }

    return {
        connectionString: process.env.DATABASE_URL,
        ssl: getSslConfig(),
        max: Number(process.env.DB_POOL_MAX || 20),
        min: Number(process.env.DB_POOL_MIN || 2),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 30000),
        statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 30000)
    };
}

function getConnectionLabel() {
    try {
        const url = new URL(process.env.DATABASE_URL);
        return `${url.hostname}${url.pathname}`;
    } catch (err) {
        return 'configured PostgreSQL database';
    }
}

async function getPool() {
    if (pool) return pool;
    if (!connectPromise) {
        pool = new Pool(buildConfig());
        connectPromise = pool.query('SELECT 1')
            .then(() => {
                console.log('[DB] Connected to PostgreSQL successfully');
                console.log(`[DB] Target: ${getConnectionLabel()}`);
                return pool;
            })
            .catch(async (err) => {
                console.error('[DB] Connection failed:', err.message);
                if (pool) {
                    await pool.end().catch(() => {});
                }
                pool = null;
                connectPromise = null;
                throw err;
            });
    }
    return connectPromise;
}

async function query(text, params = []) {
    const activePool = await getPool();
    return activePool.query(text, params);
}

async function withTransaction(callback) {
    const activePool = await getPool();
    const client = await activePool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        connectPromise = null;
        console.log('[DB] Connection pool closed');
    }
}

module.exports = { getPool, query, withTransaction, closePool };
