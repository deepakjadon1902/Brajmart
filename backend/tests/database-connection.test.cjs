const assert = require('node:assert/strict');
const { beforeEach, after, test } = require('node:test');
const mysql = require('mysql2/promise');
const previousCreatePool = mysql.createPool;
const previousEnv = { ...process.env };
const dbModule = require.resolve('../src/lib/db');
let db;
let state;
beforeEach(() => {
  Object.assign(process.env, { DB_HOST: 'isolated.invalid', DB_USER: 'contract', DB_NAME: 'contract', DB_PASSWORD: 'isolated-password', DB_PORT: '3306' });
  state = { pools: 0, queries: [], releases: 0, destroys: 0, rollbacks: 0, commits: 0, begins: 0 };
  mysql.createPool = () => {
    state.pools++;
    const query = async sql => {
      state.queries.push(sql);
      if (sql === 'SELECT 1' && state.connectionError) throw state.connectionError;
      if (sql !== 'SELECT 1' && state.readError) { const error = state.readError; state.readError = null; throw error; }
      return [[{ healthy: 1 }]];
    };
    const connection = {
      query, execute: query,
      beginTransaction: async () => { state.begins++; },
      commit: async () => { state.commits++; if (state.commitError) throw state.commitError; },
      rollback: async () => { state.rollbacks++; },
      release: () => { state.releases++; },
      destroy: () => { state.destroys++; },
    };
    return { query, execute: query, getConnection: async () => connection };
  };
  delete require.cache[dbModule];
  db = require('../src/lib/db');
});
after(() => {
  mysql.createPool = previousCreatePool;
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
});

test('database connectivity is confirmed through SELECT 1 only', async () => {
  assert.equal(db.isDbConnected(), false);
  await db.connectDb();
  assert.equal(db.isDbConnected(), true);
  assert.deepEqual(state.queries, ['SELECT 1']);
});

test('incomplete database configuration fails before creating a pool', async () => {
  delete process.env.DB_HOST;
  await assert.rejects(db.connectDb(), /not set/);
  assert.equal(state.pools, 0);
  assert.equal(db.isDbConnected(), false);
});

test('a connection timeout leaves the database disconnected', async () => {
  state.connectionError = Object.assign(new Error('Isolated connection timeout'), { code: 'ETIMEDOUT' });
  await assert.rejects(db.connectDb(), error => error.code === 'ETIMEDOUT');
  assert.equal(db.isDbConnected(), false);
});

test('a lost read connection reconnects once and retries the original query', async () => {
  await db.connectDb();
  state.readError = Object.assign(new Error('Isolated reset'), { code: 'ECONNRESET' });
  assert.deepEqual(await db.dbQuery('SELECT healthy'), [{ healthy: 1 }]);
  assert.equal(state.pools, 2);
  assert.deepEqual(state.queries, ['SELECT 1', 'SELECT healthy', 'SELECT 1', 'SELECT healthy']);
});

test('ordinary query errors are propagated without reconnecting', async () => {
  await db.connectDb();
  state.readError = Object.assign(new Error('Isolated SQL error'), { code: 'ER_PARSE_ERROR' });
  await assert.rejects(db.dbQuery('SELECT healthy'), error => error.code === 'ER_PARSE_ERROR');
  assert.equal(state.pools, 1);
});

test('a successful transaction commits and releases its connection', async () => {
  await db.connectDb();
  assert.equal(await db.withDbTransaction(async connection => { await connection.query('SELECT healthy'); return 'ok'; }), 'ok');
  assert.equal(state.commits, 1);
  assert.equal(state.releases, 1);
  assert.equal(state.rollbacks, 0);
});

test('a failed transaction rolls back and releases the connection', async () => {
  await db.connectDb();
  await assert.rejects(db.withDbTransaction(async () => { throw new Error('Isolated rollback'); }), /Isolated rollback/);
  assert.equal(state.rollbacks, 1);
  assert.equal(state.releases, 1);
});

test('an ambiguous commit destroys the connection rather than replaying the transaction', async () => {
  await db.connectDb();
  state.commitError = new Error('Isolated commit outage');
  await assert.rejects(db.withDbTransaction(async () => 'ok'), /Isolated commit outage/);
  assert.equal(state.commits, 1);
  assert.equal(state.destroys, 1);
  assert.equal(state.releases, 0);
});

test('database DDL remains blocked before a driver query is executed', async () => {
  await db.connectDb();
  await assert.rejects(db.dbQuery('CREATE TABLE forbidden (id INT)'), db.RuntimeDdlForbiddenError);
  await assert.rejects(db.dbExecute('ALTER TABLE forbidden ADD COLUMN value INT'), db.RuntimeDdlForbiddenError);
  assert.deepEqual(state.queries, ['SELECT 1']);
});
