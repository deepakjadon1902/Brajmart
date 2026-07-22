"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
dotenv_1.default.config();
const server_1 = __importDefault(require("./server"));
const db_1 = require("./lib/db");
const migrations_1 = require("./lib/migrations");
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const ALLOW_DBLESS_START = String(process.env.ALLOW_DBLESS_START || '').toLowerCase() === 'true';
const DB_CONNECT_RETRIES = Math.max(0, Number(process.env.DB_CONNECT_RETRIES ?? 10));
const DB_CONNECT_RETRY_DELAY_MS = Math.max(0, Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 2000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connectDbWithRetry = async () => {
    let lastErr;
    const dbTarget = (0, db_1.describeDbTarget)();
    for (let attempt = 0; attempt <= DB_CONNECT_RETRIES; attempt++) {
        try {
            await (0, db_1.connectDb)();
            return;
        }
        catch (err) {
            lastErr = err;
            const remaining = DB_CONNECT_RETRIES - attempt;
            if (remaining <= 0)
                break;
            console.error(`DB connection to ${dbTarget} failed (attempt ${attempt + 1}/${DB_CONNECT_RETRIES + 1}). Retrying in ${DB_CONNECT_RETRY_DELAY_MS}ms...`);
            await sleep(DB_CONNECT_RETRY_DELAY_MS);
        }
    }
    throw lastErr;
};
const formatStartupError = (err) => {
    const connectionCodes = new Set(['EACCES', 'ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT']);
    if (!connectionCodes.has(err?.code))
        return err;
    return new Error([
        `Could not connect to MySQL at ${(0, db_1.describeDbTarget)()} (${err.code}).`,
        'Check that the database server is online, port 3306 is open, and your current public IP is allowed by the database host/firewall.',
        'For frontend/API development without MySQL, set ALLOW_DBLESS_START=true in backend/.env.',
    ].join(' '));
};
const start = async () => {
    try {
        await connectDbWithRetry();
        await (0, migrations_1.runDataMigrations)();
    }
    catch (err) {
        if (!ALLOW_DBLESS_START)
            throw err;
        console.error('Starting without DB (ALLOW_DBLESS_START=true). DB error:', err);
    }
    const server = server_1.default.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
    server.on('error', (err) => {
        console.error('Server failed to listen:', err);
        process.exit(1);
    });
};
start().catch((err) => {
    console.error('Failed to start server:', formatStartupError(err));
    process.exit(1);
});
