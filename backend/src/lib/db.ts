import { AsyncLocalStorage } from 'async_hooks';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { isLocalMigrationCliInvocation, resolveAutomaticMigrationDecision } from './automaticMigrationPolicy';

let pool: Pool | null = null;
let connected = false;
let connecting: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setInterval> | null = null;
const migrationDdlPermit = new AsyncLocalStorage<boolean>();

export class RuntimeDdlForbiddenError extends Error {
  constructor() {
    super('Runtime database DDL is disabled; apply reviewed migrations through the local-only migration command.');
    this.name = 'RuntimeDdlForbiddenError';
  }
}

const isDdlStatement = (sql: string) => {
  const statement = String(sql || '').replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*/, '').trimStart();
  return /^(?:CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(statement);
};

export const assertNoRuntimeDdl = (sql: string) => {
  if (isDdlStatement(sql) && migrationDdlPermit.getStore() !== true) throw new RuntimeDdlForbiddenError();
};

export const withMigrationDdlPermit = <T>(operation: () => Promise<T>) => {
  if (!resolveAutomaticMigrationDecision(process.env).allowed || !isLocalMigrationCliInvocation()) {
    throw new RuntimeDdlForbiddenError();
  }
  return migrationDdlPermit.run(true, operation);
};

export const guardDdlConnection = <T extends PoolConnection>(connection: T): T =>
  new Proxy(connection, {
    get(target, property) {
      if (property === 'query' || property === 'execute') {
        const method = Reflect.get(target, property, target);
        return (...args: unknown[]) => {
          const candidate = args[0];
          const sql = typeof candidate === 'string'
            ? candidate
            : typeof candidate === 'object' && candidate !== null && 'sql' in candidate
              ? String((candidate as { sql?: unknown }).sql || '')
              : '';
          assertNoRuntimeDdl(sql);
          return (method as (...callArgs: unknown[]) => unknown).apply(target, args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

const getConfig = () => {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const connectTimeout = process.env.DB_CONNECT_TIMEOUT_MS ? Number(process.env.DB_CONNECT_TIMEOUT_MS) : 10_000;
  return { host, user, database, password, port, connectTimeout };
};

export const describeDbTarget = () => {
  const { host, database, port } = getConfig();
  return `${host || '<missing-host>'}:${port}/${database || '<missing-db>'}`;
};

const connectDbAttempt = async () => {
  const { host, user, database, password, port, connectTimeout } = getConfig();
  if (!host || !user || !database) {
    connected = false;
    throw new Error('DB_HOST/DB_USER/DB_NAME is not set.');
  }
  try {
    pool ??= mysql.createPool({
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
  } catch (err) {
    connected = false;
    throw err;
  }
};

// Share health checks and reuse the pool: mysql2 replaces broken connections.
// Recreating a pool on every retry leaves the previous pool's connections open.
export const connectDb = (): Promise<void> => {
  if (!connecting) {
    connecting = connectDbAttempt().finally(() => { connecting = null; });
  }
  return connecting;
};

export const isDbConnected = () => connected && !!pool;

// Routes reject requests while disconnected, so request-level retries alone
// cannot recover after a failed reconnect or a DB-less development startup.
export const startDbReconnectScheduler = () => {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(() => {
    if (!isDbConnected()) void connectDb().catch(() => {});
  }, 10_000);
  reconnectTimer.unref();
};

const shouldReconnect = (err: any) => {
  const code = err?.code || err?.errno || '';
  const message = String(err?.message || '');
  return (
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    message.includes('ECONNRESET')
  );
};

const withRetry = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (err) {
    if (!shouldReconnect(err)) throw err;
    connected = false;
    await connectDb();
    return await fn();
  }
};

export const dbQuery = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  assertNoRuntimeDdl(sql);
  if (!pool) throw new Error('Database not initialized');
  const [rows] = await withRetry(() => pool!.query(sql, params));
  return rows as T[];
};

export const dbExecute = async (sql: string, params: any[] = []) => {
  assertNoRuntimeDdl(sql);
  if (!pool) throw new Error('Database not initialized');
  const [result] = await withRetry(() => pool!.execute(sql, params));
  return result as any;
};

export const withDbTransaction = async <T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  if (!pool) throw new Error('Database not initialized');
  const connection = await pool.getConnection();
  let discardConnection = false;
  let commitAttempted = false;
  try {
    await connection.beginTransaction();
    const result = await fn(guardDdlConnection(connection));
    commitAttempted = true;
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // Never return a connection with uncertain transaction state to the pool.
      discardConnection = true;
    }
    // A failed COMMIT has an ambiguous outcome. The caller must not reuse the
    // protocol connection or blindly replay the surrounding transaction.
    if (commitAttempted) discardConnection = true;
    throw err;
  } finally {
    if (discardConnection) {
      try { connection.destroy(); } catch { /* Unusable connections must never return to the pool. */ }
    } else connection.release();
  }
};
