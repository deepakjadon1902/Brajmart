"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withDbTransaction = exports.dbExecute = exports.dbQuery = exports.isDbConnected = exports.connectDb = exports.describeDbTarget = exports.guardDdlConnection = exports.withMigrationDdlPermit = exports.assertNoRuntimeDdl = exports.RuntimeDdlForbiddenError = void 0;
const async_hooks_1 = require("async_hooks");
const promise_1 = __importDefault(require("mysql2/promise"));
const automaticMigrationPolicy_1 = require("./automaticMigrationPolicy");
let pool = null;
let connected = false;
const migrationDdlPermit = new async_hooks_1.AsyncLocalStorage();
class RuntimeDdlForbiddenError extends Error {
    constructor() {
        super('Runtime database DDL is disabled; apply reviewed migrations through the local-only migration command.');
        this.name = 'RuntimeDdlForbiddenError';
    }
}
exports.RuntimeDdlForbiddenError = RuntimeDdlForbiddenError;
const isDdlStatement = (sql) => {
    const statement = String(sql || '').replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*/, '').trimStart();
    return /^(?:CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(statement);
};
const assertNoRuntimeDdl = (sql) => {
    if (isDdlStatement(sql) && migrationDdlPermit.getStore() !== true)
        throw new RuntimeDdlForbiddenError();
};
exports.assertNoRuntimeDdl = assertNoRuntimeDdl;
const withMigrationDdlPermit = (operation) => {
    if (!(0, automaticMigrationPolicy_1.resolveAutomaticMigrationDecision)(process.env).allowed || !(0, automaticMigrationPolicy_1.isLocalMigrationCliInvocation)()) {
        throw new RuntimeDdlForbiddenError();
    }
    return migrationDdlPermit.run(true, operation);
};
exports.withMigrationDdlPermit = withMigrationDdlPermit;
const guardDdlConnection = (connection) => new Proxy(connection, {
    get(target, property) {
        if (property === 'query' || property === 'execute') {
            const method = Reflect.get(target, property, target);
            return (...args) => {
                const candidate = args[0];
                const sql = typeof candidate === 'string'
                    ? candidate
                    : typeof candidate === 'object' && candidate !== null && 'sql' in candidate
                        ? String(candidate.sql || '')
                        : '';
                (0, exports.assertNoRuntimeDdl)(sql);
                return method.apply(target, args);
            };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
    },
});
exports.guardDdlConnection = guardDdlConnection;
const getConfig = () => {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const database = process.env.DB_NAME;
    const password = process.env.DB_PASSWORD || '';
    const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
    const connectTimeout = process.env.DB_CONNECT_TIMEOUT_MS ? Number(process.env.DB_CONNECT_TIMEOUT_MS) : 10000;
    return { host, user, database, password, port, connectTimeout };
};
const describeDbTarget = () => {
    const { host, database, port } = getConfig();
    return `${host || '<missing-host>'}:${port}/${database || '<missing-db>'}`;
};
exports.describeDbTarget = describeDbTarget;
const connectDb = async () => {
    const { host, user, database, password, port, connectTimeout } = getConfig();
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
            connectTimeout,
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
    (0, exports.assertNoRuntimeDdl)(sql);
    if (!pool)
        throw new Error('Database not initialized');
    const [rows] = await withRetry(() => pool.query(sql, params));
    return rows;
};
exports.dbQuery = dbQuery;
const dbExecute = async (sql, params = []) => {
    (0, exports.assertNoRuntimeDdl)(sql);
    if (!pool)
        throw new Error('Database not initialized');
    const [result] = await withRetry(() => pool.execute(sql, params));
    return result;
};
exports.dbExecute = dbExecute;
const withDbTransaction = async (fn) => {
    if (!pool)
        throw new Error('Database not initialized');
    const connection = await pool.getConnection();
    let discardConnection = false;
    let commitAttempted = false;
    try {
        await connection.beginTransaction();
        const result = await fn((0, exports.guardDdlConnection)(connection));
        commitAttempted = true;
        await connection.commit();
        return result;
    }
    catch (err) {
        try {
            await connection.rollback();
        }
        catch {
            // Never return a connection with uncertain transaction state to the pool.
            discardConnection = true;
        }
        // A failed COMMIT has an ambiguous outcome. The caller must not reuse the
        // protocol connection or blindly replay the surrounding transaction.
        if (commitAttempted)
            discardConnection = true;
        throw err;
    }
    finally {
        if (discardConnection) {
            try {
                connection.destroy();
            }
            catch { /* Unusable connections must never return to the pool. */ }
        }
        else
            connection.release();
    }
};
exports.withDbTransaction = withDbTransaction;
