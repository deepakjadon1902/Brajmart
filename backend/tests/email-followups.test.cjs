const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { beforeEach, test } = require('node:test');
const db = require('../src/lib/db');
const email = require('../src/lib/email');
const pricing = require('../src/lib/orderPricing');

// Test readiness against the reviewed SQL, so a drift between that migration
// and runtime requirements fails here before an application release.
const migration = readFileSync(require.resolve('../sql/migrate_email_followups.sql'), 'utf8');
const migratedColumns = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE/g)]
  .flatMap(([, tableName, body]) => [...body.matchAll(/^\s+([a-z_]+) ((?:BIGINT|VARCHAR|CHAR|TINYINT|DATETIME|TIMESTAMP|JSON|DECIMAL|ENUM)[^\n]*)/gim)]
    .map(([, columnName, columnType]) => ({ tableName, columnName, columnType })));
let state;
const writes = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  state.writes.push({ sql, params });
  if (state.writeFailure && sql.includes(state.writeFailure.table)) throw state.writeFailure.error;
  return { affectedRows: 1, insertId: 1 };
};
const query = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  state.reads.push({ sql, params });
  if (sql.includes('information_schema.COLUMNS')) {
    if (state.schemaFailure) throw state.schemaFailure;
    return state.columns;
  }
  if (sql.includes('SELECT id FROM cart_reminder_jobs')) return state.job ? [{ id: state.job.id }] : [];
  if (sql.includes('SELECT * FROM cart_reminder_jobs')) return [{ ...state.job, attempts: 1 }];
  if (sql.includes('FROM orders o') && sql.includes('JOIN payment_status')) return [];
  if (sql.includes('FROM orders o')) return state.completedOrder ? [{ id: 42 }] : [];
  if (sql.includes('SELECT cart_reminder_consent')) return [{ cart_reminder_consent: state.consent ? 1 : 0 }];
  if (sql.includes('SELECT status FROM cart_reminder_jobs')) return [{ status: 'sending' }];
  if (sql.includes('FROM offer_email_deliveries')) return [];
  throw new Error(`Unexpected test query: ${sql}`);
};
db.dbQuery = query;
db.dbExecute = writes;
db.isDbConnected = () => true;
db.withDbTransaction = async work => work({ execute: async (sql, params) => [await (/^\s*SELECT/i.test(sql) ? query(sql, params) : writes(sql, params))] });
email.sendCartReminderEmail = async (...args) => {
  state.messages.push(args);
  if (state.providerFailure) throw state.providerFailure;
};
email.sendCouponOfferEmail = async () => { throw new Error('Unexpected offer submission'); };
email.sendPendingPaymentReminderEmail = async () => { throw new Error('Unexpected payment reminder'); };
pricing.priceAndValidateOrderItems = async () => ({ ok: true, items: [{ productId: 5, name: 'Test cart item', price: 100, quantity: 1 }], itemsSubtotal: 100 });

const health = require('../src/lib/emailFollowupHealth');
const followups = require('../src/lib/cartFollowups');
beforeEach(() => {
  state = { columns: structuredClone(migratedColumns), reads: [], writes: [], messages: [], consent: true };
});
const job = () => ({ id: 1, email: 'recipient@example.invalid', customer_name: 'Private customer', items: '[{"productId":5,"quantity":1}]', activity_at: '2026-11-01T00:00:00Z', idempotency_key: 'a'.repeat(64) });

test('the reviewed email migration satisfies all worker schema requirements using metadata reads only', async () => {
  assert.equal(new Set(migratedColumns.map(row => row.tableName)).size, 4);
  assert.deepEqual(await health.inspectEmailFollowupSchema(), []);
  assert.equal(state.reads.length, 1);
  assert.match(state.reads[0].sql.trim(), /^SELECT/);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.messages, []);
});

test('missing tables are named before any queue updates or email attempts', async () => {
  state.columns = state.columns.filter(row => row.tableName !== 'offer_email_deliveries');
  await assert.rejects(followups.runCartFollowupBatch(), error => {
    const diagnostic = health.describeEmailFollowupFailure(error);
    assert.equal(diagnostic.stage, 'schema-check');
    assert.equal(diagnostic.code, 'EMAIL_FOLLOWUP_SCHEMA_INCOMPLETE');
    assert.deepEqual(diagnostic.issues, [{ table: 'offer_email_deliveries', missingTable: true }]);
    assert.match(diagnostic.action, /migrate_email_followups.sql/);
    return true;
  });
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.messages, []);
});

test('partial migrations identify missing columns and unsupported uncertain statuses', async () => {
  state.columns = state.columns.filter(row => !(row.tableName === 'cart_reminder_jobs' && row.columnName === 'idempotency_key'));
  state.columns.find(row => row.tableName === 'cart_reminder_jobs' && row.columnName === 'status').columnType = "enum('pending','sending','sent','cancelled','failed')";
  assert.deepEqual(await health.inspectEmailFollowupSchema(), [
    { table: 'cart_reminder_jobs', missingColumns: ['idempotency_key'] },
    { table: 'cart_reminder_jobs', missingStatuses: ['uncertain'] },
  ]);
});

test('database errors identify the failing batch stage without leaking SQL, credentials or recipient information', async () => {
  const sensitive = 'recipient@example.invalid Bearer private-api-key SELECT * FROM private_table';
  state.writeFailure = { table: 'offer_email_deliveries', error: Object.assign(new Error(sensitive), { code: 'ER_TABLEACCESS_DENIED_ERROR', sql: sensitive, sqlMessage: sensitive }) };
  await assert.rejects(followups.runCartFollowupBatch(), error => {
    const diagnostic = health.describeEmailFollowupFailure(error);
    assert.equal(diagnostic.stage, 'offer-email-recovery');
    assert.equal(diagnostic.code, 'ER_TABLEACCESS_DENIED_ERROR');
    assert.match(diagnostic.action, /permission/);
    assert.equal(JSON.stringify(diagnostic).includes('recipient@'), false);
    assert.equal(JSON.stringify(diagnostic).includes('private-api-key'), false);
    assert.equal(JSON.stringify(diagnostic).includes('SELECT'), false);
    return true;
  });
  assert.deepEqual(state.messages, []);
});

test('unknown exceptions and untrusted error codes are not echoed in diagnostics', () => {
  const diagnostic = health.describeEmailFollowupFailure({ code: 'secret-recipient@example.invalid', message: 'private-api-key' });
  assert.equal(diagnostic.code, 'FOLLOWUP_BATCH_FAILED');
  assert.equal(JSON.stringify(diagnostic).includes('secret-recipient'), false);
  assert.equal(JSON.stringify(diagnostic).includes('private-api-key'), false);
  assert.equal(health.describeEmailFollowupFailure({ code: '__proto__' }).code, 'FOLLOWUP_BATCH_FAILED');
});

test('schema connection failures do not mutate queues and successful later batches recover', async () => {
  state.schemaFailure = Object.assign(new Error('private database connection string'), { code: 'ETIMEDOUT' });
  await assert.rejects(followups.runCartFollowupBatch(), error => {
    assert.equal(health.describeEmailFollowupFailure(error).code, 'ETIMEDOUT');
    return true;
  });
  assert.equal(state.writes.length, 0);
  state.schemaFailure = null;
  await followups.runCartFollowupBatch();
  assert.equal(state.writes.length, 2);
  assert.deepEqual(state.messages, []);
});

test('an empty healthy queue processes without creating schema or sending emails', async () => {
  await followups.runCartFollowupBatch();
  assert.equal(state.writes.length, 2);
  assert.ok(state.writes.every(write => /^UPDATE/.test(write.sql.trim())));
  assert.deepEqual(state.messages, []);
});

test('completed orders and inactive consent continue to suppress reminders', async () => {
  state.job = job(); state.completedOrder = true;
  await followups.runCartFollowupBatch();
  assert.deepEqual(state.messages, []);
  assert.ok(state.writes.some(write => write.sql.includes('A completed order was found')));
  state.completedOrder = false; state.consent = false;
  await followups.runCartFollowupBatch();
  assert.deepEqual(state.messages, []);
  assert.ok(state.writes.some(write => write.sql.includes('Consent is not active')));
});

test('an eligible opted-in cart still dispatches through the idempotent provider path', async () => {
  state.job = job();
  await followups.runCartFollowupBatch();
  assert.equal(state.messages.length, 1);
  const [to, payload] = state.messages[0];
  assert.equal(to, state.job.email);
  assert.match(payload.idempotencyKey, /^cart-reminder-1-/);
  assert.match(payload.unsubscribeUrl, /\/email\/unsubscribe#token=[a-f0-9]{64}$/);
  assert.ok(state.writes.some(write => write.sql.includes("status = 'sent'")));
});

test('provider rejections preserve bounded retries and safe stored diagnostics', async () => {
  state.job = job();
  state.providerFailure = new email.EmailProviderResponseError('recipient@example.invalid private-api-key', 429);
  await followups.runCartFollowupBatch();
  assert.equal(state.messages.length, 1);
  const retry = state.writes.find(write => write.sql.includes('due_at = DATE_ADD'));
  assert.ok(retry);
  assert.equal(retry.params[1], 'Email provider returned HTTP 429');
  assert.equal(JSON.stringify(state.writes).includes('private-api-key'), false);
});

test('scheduler logs actionable schema diagnostics and resumes after the schema is repaired', async () => {
  const originalTimer = global.setInterval;
  const originalLog = console.error;
  const savedEnv = { ...process.env };
  let tick;
  const logs = [];
  global.setInterval = callback => { tick = callback; return { unref() {} }; };
  console.error = (...args) => { logs.push(args); };
  try {
    process.env.EMAIL_FOLLOWUPS_WORKER_ENABLED = 'false';
    followups.startCartReminderScheduler();
    assert.equal(tick, undefined);
    process.env.EMAIL_FOLLOWUPS_WORKER_ENABLED = 'true';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'private-test-key';
    process.env.EMAIL_FROM = 'sender@example.invalid';
    state.columns = [];
    followups.startCartReminderScheduler();
    await new Promise(setImmediate);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][1].code, 'EMAIL_FOLLOWUP_SCHEMA_INCOMPLETE');
    assert.equal(logs[0][1].issues.length, 4);
    assert.deepEqual(state.writes, []);
    state.columns = structuredClone(migratedColumns);
    tick();
    await new Promise(setImmediate);
    assert.equal(logs.length, 1);
    assert.equal(state.writes.length, 2);
    assert.deepEqual(state.messages, []);
  } finally {
    global.setInterval = originalTimer;
    console.error = originalLog;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});
