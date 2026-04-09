import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;
let connected = false;

const getConfig = () => {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  return { host, user, database, password, port };
};

export const connectDb = async () => {
  const { host, user, database, password, port } = getConfig();
  if (!host || !user || !database) {
    connected = false;
    throw new Error('DB_HOST/DB_USER/DB_NAME is not set.');
  }
  try {
    pool = mysql.createPool({
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
  } catch (err) {
    connected = false;
    throw err;
  }
};

export const isDbConnected = () => connected && !!pool;

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
  if (!pool) throw new Error('Database not initialized');
  const [rows] = await withRetry(() => pool!.query(sql, params));
  return rows as T[];
};

export const dbExecute = async (sql: string, params: any[] = []) => {
  if (!pool) throw new Error('Database not initialized');
  const [result] = await withRetry(() => pool!.execute(sql, params));
  return result as any;
};
