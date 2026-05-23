import dotenv from 'dotenv';

dotenv.config();

import app from './server';
import { connectDb } from './lib/db';
import { runDataMigrations } from './lib/migrations';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const ALLOW_DBLESS_START = String(process.env.ALLOW_DBLESS_START || '').toLowerCase() === 'true';
const DB_CONNECT_RETRIES = Math.max(0, Number(process.env.DB_CONNECT_RETRIES ?? 10));
const DB_CONNECT_RETRY_DELAY_MS = Math.max(0, Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 2000));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const connectDbWithRetry = async () => {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= DB_CONNECT_RETRIES; attempt++) {
    try {
      await connectDb();
      return;
    } catch (err) {
      lastErr = err;
      const remaining = DB_CONNECT_RETRIES - attempt;
      if (remaining <= 0) break;
      console.error(`DB connection failed (attempt ${attempt + 1}/${DB_CONNECT_RETRIES + 1}). Retrying in ${DB_CONNECT_RETRY_DELAY_MS}ms...`);
      await sleep(DB_CONNECT_RETRY_DELAY_MS);
    }
  }
  throw lastErr;
};

const start = async () => {
  try {
    await connectDbWithRetry();
    await runDataMigrations();
  } catch (err) {
    if (!ALLOW_DBLESS_START) throw err;
    console.error('Starting without DB (ALLOW_DBLESS_START=true). DB error:', err);
  }
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.on('error', (err) => {
    console.error('Server failed to listen:', err);
    process.exit(1);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
