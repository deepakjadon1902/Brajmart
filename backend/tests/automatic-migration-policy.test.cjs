const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  resolveAutomaticMigrationDecision,
  runAutomaticMigrationsIfAllowed,
} = require('../src/lib/automaticMigrationPolicy');

const localEnv = (extra = {}) => ({
  APP_ENV: 'development',
  NODE_ENV: 'development',
  RUN_DATA_MIGRATIONS: 'true',
  MIGRATION_EXECUTION_CONTEXT: 'local-cli',
  MIGRATION_LOCAL_ONLY_CONFIRMATION: 'yes-local-development-db',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'brajmart_local',
  LOCAL_MIGRATION_DB_NAME: 'brajmart_local',
  LOCAL_MIGRATION_DB_HOSTNAME: 'brajmart-local-mysql',
  LOCAL_MIGRATION_DB_SERVER_ID: '1001',
  LOCAL_MIGRATION_DB_PORT: '3306',
  ...extra,
});

test('startup migrations are disabled by default in production-like environments', async () => {
  for (const env of [
    { APP_ENV: 'production', NODE_ENV: 'production' },
    { APP_ENV: 'staging', NODE_ENV: 'production' },
  ]) {
    let calls = 0;
    const decision = await runAutomaticMigrationsIfAllowed(env, async () => { calls += 1; });
    assert.equal(decision.allowed, false);
    assert.equal(calls, 0);
  }
});

test('an explicit migration flag cannot enable automatic production or staging migrations', () => {
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'production', NODE_ENV: 'production', RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'production_forbidden');
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'staging', NODE_ENV: 'development', RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'staging_forbidden');
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'staging', NODE_ENV: 'production', RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'production_forbidden');
});

test('the migration implementation itself refuses a direct production call', async () => {
  const db = require('../src/lib/db');
  const originalIsDbConnected = db.isDbConnected;
  const previous = Object.fromEntries(['APP_ENV', 'NODE_ENV', 'RUN_DATA_MIGRATIONS']
    .map((key) => [key, process.env[key]]));
  db.isDbConnected = () => { throw new Error('database must not be touched'); };
  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  process.env.RUN_DATA_MIGRATIONS = 'true';
  try {
    const { runDataMigrations } = require('../src/lib/migrations');
    await assert.doesNotReject(runDataMigrations());
  } finally {
    db.isDbConnected = originalIsDbConnected;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('unknown or inconsistent environment identity always fails closed', () => {
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'preview', NODE_ENV: 'development', RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'unknown_environment');
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'development', NODE_ENV: 'production', RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'production_forbidden');
  assert.equal(resolveAutomaticMigrationDecision({
    RUN_DATA_MIGRATIONS: 'true',
  }).reason, 'unknown_environment');
});

test('local development requires explicit local context and a loopback local-only schema', async () => {
  let calls = 0;
  assert.equal(resolveAutomaticMigrationDecision({
    APP_ENV: 'development', NODE_ENV: 'development',
  }).reason, 'opt_in_missing');
  const decision = await runAutomaticMigrationsIfAllowed(localEnv(), async () => { calls += 1; }, ['node', 'scripts/migrateLocal.ts']);
  assert.equal(decision.allowed, true);
  assert.equal(calls, 1);
});

test('only the dedicated local migration CLI can run an otherwise approved migration', async () => {
  let calls = 0;
  const decision = await runAutomaticMigrationsIfAllowed(localEnv(), async () => { calls += 1; }, ['node', 'src/index.ts']);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'local_cli_invocation_missing');
  assert.equal(calls, 0);

  const startup = readFileSync(resolve(__dirname, '../src/index.ts'), 'utf8');
  assert.doesNotMatch(startup, /runDataMigrations|automaticMigrations/);
});

test('hosted labels and mismatched or remote database targets cannot opt into migrations', () => {
  const blocked = [
    [{ ...localEnv(), DB_HOST: 'mysql.example.invalid' }, 'database_target_not_local'],
    [{ ...localEnv(), DB_NAME: 'brajmart_prod', LOCAL_MIGRATION_DB_NAME: 'brajmart_prod' }, 'database_name_not_local'],
    [{ ...localEnv(), DB_NAME: 'brajmart_local', LOCAL_MIGRATION_DB_NAME: 'other_local' }, 'database_name_not_local'],
    [{ ...localEnv(), LOCAL_MIGRATION_DB_SERVER_ID: '' }, 'database_identity_not_confirmed'],
    [{ ...localEnv(), DB_PORT: '3307' }, 'database_identity_not_confirmed'],
    [{ ...localEnv(), RENDER: 'true' }, 'deployment_context_detected'],
    [{ ...localEnv(), RENDER_SERVICE_ID: 'srv-example' }, 'deployment_context_detected'],
    [{ ...localEnv(), VERCEL: '1' }, 'deployment_context_detected'],
    [{ ...localEnv(), VERCEL_URL: 'preview.example.invalid' }, 'deployment_context_detected'],
    [{ ...localEnv(), CI: 'true' }, 'deployment_context_detected'],
    [{ ...localEnv(), APP_ENV: 'preview' }, 'unknown_environment'],
    [{ ...localEnv(), APP_ENV: 'staging' }, 'staging_forbidden'],
    [{ ...localEnv(), NODE_ENV: 'production' }, 'production_forbidden'],
  ];
  for (const [env, reason] of blocked) assert.equal(resolveAutomaticMigrationDecision(env).reason, reason);
});

test('local migration requires the connected MySQL server identity to match explicit local evidence', () => {
  const { isConfirmedLocalMigrationDatabaseIdentity } = require('../src/lib/automaticMigrationPolicy');
  const expected = { databaseName: 'brajmart_local', hostname: 'local-mysql', serverId: '1001', port: '3306' };
  assert.equal(isConfirmedLocalMigrationDatabaseIdentity(expected, {
    databaseName: 'brajmart_local', hostname: 'local-mysql', serverId: 1001, port: 3306,
  }), true);
  assert.equal(isConfirmedLocalMigrationDatabaseIdentity(expected, {
    databaseName: 'brajmart_prod', hostname: 'local-mysql', serverId: 1001, port: 3306,
  }), false);
  assert.equal(isConfirmedLocalMigrationDatabaseIdentity(expected, {
    databaseName: 'brajmart_local', hostname: 'remote-mysql', serverId: 1001, port: 3306,
  }), false);
});

test('direct migration invocation cannot bypass the local-only gate', async () => {
  const db = require('../src/lib/db');
  const originalIsDbConnected = db.isDbConnected;
  const previous = Object.fromEntries([
    ...Object.keys(localEnv()), 'APP_ENV', 'NODE_ENV',
  ].map((key) => [key, process.env[key]]));
  db.isDbConnected = () => { throw new Error('database must not be touched'); };
  Object.assign(process.env, localEnv({ DB_HOST: 'remote.example.invalid' }));
  try {
    const { runDataMigrations } = require('../src/lib/migrations');
    await assert.doesNotReject(runDataMigrations());
  } finally {
    db.isDbConnected = originalIsDbConnected;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('all normal DB entry points reject DDL unless a local migration permit is active', async () => {
  const db = require('../src/lib/db');
  const priorArgv = process.argv;
  const previousEnv = Object.fromEntries(Object.keys(localEnv()).map((key) => [key, process.env[key]]));
  const ddl = [
    'CREATE TABLE x (id INT)', 'CREATE TEMPORARY TABLE x (id INT)',
    'ALTER TABLE x ADD COLUMN y INT', 'DROP TABLE x', 'TRUNCATE TABLE x',
    'RENAME TABLE x TO y', 'GRANT SELECT ON x TO user', 'REVOKE SELECT ON x FROM user',
    '/* comment */ CREATE INDEX ix ON x (id)',
  ];
  for (const sql of ddl) {
    await assert.rejects(db.dbExecute(sql), (error) => error.name === 'RuntimeDdlForbiddenError');
    await assert.rejects(db.dbQuery(sql), (error) => error.name === 'RuntimeDdlForbiddenError');
  }
  let calls = 0;
  const guarded = db.guardDdlConnection({
    query: async () => { calls += 1; },
    execute: async () => { calls += 1; },
  });
  assert.throws(() => guarded.execute('CREATE TABLE x (id INT)'), /Runtime database DDL is disabled/);
  try {
    Object.assign(process.env, localEnv());
    process.argv = ['node', 'scripts/migrateLocal.ts'];
    await db.withMigrationDdlPermit(async () => {
      await guarded.execute('CREATE TABLE x (id INT)');
    });
    assert.equal(calls, 1);
  } finally {
    process.argv = priorArgv;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
