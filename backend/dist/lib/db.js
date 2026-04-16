"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbExecute = exports.dbQuery = exports.isDbConnected = exports.connectDb = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
let pool = null;
let connected = false;
const getConfig = () => {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const database = process.env.DB_NAME;
    const password = process.env.DB_PASSWORD || '';
    const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
    return { host, user, database, password, port };
};
const connectDb = async () => {
    const { host, user, database, password, port } = getConfig();
    if (!host || !user || !database) {
        connected = false;
        throw new Error('DB_HOST/DB_USER/DB_NAME is not set.');
    }
    try {
        pool = promise_1.default.createPool({
            host,
            user,
            database,
            password,
            port,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            timezone: 'Z',
        });
        await pool.query('SELECT 1');
        connected = true;
        console.log('MySQL connected');
    }
    catch (err) {
        connected = false;
        throw err;
    }
};
exports.connectDb = connectDb;
const isDbConnected = () => connected && !!pool;
exports.isDbConnected = isDbConnected;
const shouldReconnect = (err) => {
    const code = err?.code || err?.errno || '';
    const message = String(err?.message || '');
    return (code === 'PROTOCOL_CONNECTION_LOST' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE' ||
        message.includes('ECONNRESET'));
};
const withRetry = async (fn) => {
    try {
        return await fn();
    }
    catch (err) {
        if (!shouldReconnect(err))
            throw err;
        connected = false;
        await (0, exports.connectDb)();
        return await fn();
    }
};
const dbQuery = async (sql, params = []) => {
    if (!pool)
        throw new Error('Database not initialized');
    const [rows] = await withRetry(() => pool.query(sql, params));
    return rows;
};
exports.dbQuery = dbQuery;
const dbExecute = async (sql, params = []) => {
    if (!pool)
        throw new Error('Database not initialized');
    const [result] = await withRetry(() => pool.execute(sql, params));
    return result;
};
exports.dbExecute = dbExecute;
