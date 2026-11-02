import dotenv from 'dotenv';
import path from 'node:path';
import { connectDb, closeDb } from '../src/lib/db';
import { runDataMigrations } from '../src/lib/migrations';
import { resolveAutomaticMigrationDecision, isLocalMigrationCliInvocation } from '../src/lib/automaticMigrationPolicy';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const main = async () => {
  if (!isLocalMigrationCliInvocation()) {
    throw new Error('Migrations may only run through the dedicated local CLI entrypoint.');
  }
  const decision = resolveAutomaticMigrationDecision(process.env);
  if (!decision.allowed) throw new Error(`Local migration refused (${decision.reason}).`);
  await connectDb();
  try {
    await runDataMigrations();
  } finally {
    await closeDb();
  }
};

main().catch((error: any) => {
  console.error('Local migration failed:', error?.name || 'Error', error?.message || '');
  process.exitCode = 1;
});
