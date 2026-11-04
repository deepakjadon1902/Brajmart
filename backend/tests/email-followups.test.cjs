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
  if (sql.includes('FROM products')) return state.products;
  if (sql.includes('SELECT p.email')) return state.accountConsent ? [{ email: 'recipient@example.invalid', customer_name: 'Customer' }] : [];
  if (sql.includes('SELECT c.items AS cart_items')) return state.accountItems ? [state.accountItems] : [];
  if (sql.includes('SELECT items, status FROM cart_reminder_jobs')) return state.activeJobs || [];
  if (sql.includes('idempotency_key = ? LIMIT 1')) return state.existingSnapshot ? [{ id: 7, ...state.existingSnapshot }] : [];
  if (sql.includes('SELECT id FROM cart_reminder_jobs')) return state.job ? [{ id: state.job.id }] : [];
  if (sql.includes('SELECT * FROM cart_reminder_jobs')) return [{ ...state.job, attempts: 1 }];
  if (sql.includes('FROM orders o') && sql.includes('JOIN payment_status')) return state.pendingPayment ? [state.pendingPayment] : [];
  if (sql.includes('FROM orders o')) return state.completedOrder ? [{ id: 42 }] : [];
  if (sql.includes('SELECT cart_reminder_consent')) return [{ cart_reminder_consent: state.consent ? 1 : 0, consent_version: state.consentVersion || 'checkout-contact-v1' }];
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
email.sendPendingPaymentReminderEmail = async (...args) => { state.paymentMessages.push(args); };
email.sendSavedProductsReminderEmail = async (...args) => { state.savedMessages.push(args); };
pricing.priceAndValidateOrderItems = async () => ({ ok: true, items: [{ productId: 5, name: 'Test cart item', price: 100, quantity: 1 }], itemsSubtotal: 100 });

const health = require('../src/lib/emailFollowupHealth');
const followups = require('../src/lib/cartFollowups');
const savedProducts = require('../src/lib/savedProductReminders');
beforeEach(() => {
  state = { columns: structuredClone(migratedColumns), reads: [], writes: [], messages: [], paymentMessages: [], savedMessages: [], consent: true,
    products: [{ id: 5, name: 'Current catalog name', slug: 'current-product', sku: 'SKU-5', price: 125, in_stock: 1, stock_quantity: 3, reserved_quantity: 1 }] };
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
  assert.equal(state.writes.length, 3);
  assert.deepEqual(state.messages, []);
});

test('an empty healthy queue processes without creating schema or sending emails', async () => {
  await followups.runCartFollowupBatch();
  assert.equal(state.writes.length, 3);
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
  const retry = state.writes.find(write => write.sql.includes('due_at = DATE_ADD(NOW()'));
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
    assert.equal(state.writes.length, 3);
    assert.deepEqual(state.messages, []);
  } finally {
    global.setInterval = originalTimer;
    console.error = originalLog;
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
  }
});

test('checkout capture schedules a verified cart after exactly three hours', async () => {
  const result = await followups.captureEmailFollowup({
    email: '  Recipient@example.invalid ', customerName: '', userId: null,
    items: [{ productId: 5, quantity: 1 }],
    consent: { cartReminder: true, offerEmail: false, whatsappFollowup: false },
  });
  assert.equal(result.reminderScheduled, true);
  const insert = state.writes.find(write => write.sql.includes('INSERT INTO cart_reminder_jobs'));
  assert.match(insert.sql, /DATE_ADD\(NOW\(\), INTERVAL \? HOUR\)/);
  assert.equal(insert.params[0], 'recipient@example.invalid');
  assert.equal(insert.params[5], 3);
  assert.deepEqual(JSON.parse(insert.params[3]), [{ productId: 5, name: 'Test cart item', price: 100, quantity: 1 }]);
});

test('unchecking the cart reminder cancels queued messages without unsubscribing unrelated preferences', async () => {
  const result = await followups.captureEmailFollowup({
    email: 'recipient@example.invalid', customerName: '', userId: null, items: [],
    consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false }, revokeCartReminder: true,
  });
  assert.equal(result.reminderScheduled, false);
  const preference = state.writes.find(write => write.sql.includes('INSERT INTO email_contact_preferences'));
  assert.match(preference.sql, /cart_reminder_consent = IF\(\? = 1, 0,/);
  assert.equal(preference.params.at(-1), 1);
  assert.match(preference.sql, /offer_email_consent = GREATEST/);
  assert.ok(state.writes.some(write => write.sql.includes('Cart reminder consent withdrawn') && write.sql.includes("'pending', 'sending'")));
  assert.ok(!state.writes.some(write => write.sql.includes('INSERT INTO cart_reminder_jobs')));
});

test('capture rejects missing opt-ins and conflicting opt-in/withdrawal before writing', async () => {
  for (const input of [
    { consent: { cartReminder: false, offerEmail: false, whatsappFollowup: false } },
    { consent: { cartReminder: true, offerEmail: false, whatsappFollowup: false }, revokeCartReminder: true },
  ]) await assert.rejects(followups.captureEmailFollowup({ email: 'recipient@example.invalid', customerName: '', userId: null, items: [{ productId: 5 }], ...input }), followups.FollowupValidationError);
  assert.equal(state.writes.length, 0);
});

test('previous four-hour jobs move to three hours without changing retries or uncertain messages', async () => {
  await followups.runCartFollowupBatch();
  const update = state.writes.find(write => write.sql.includes('SET due_at = DATE_ADD(activity_at'));
  assert.deepEqual(update.params, [3, 3]);
  assert.match(update.sql, /status = 'pending' AND attempts = 0/);
  assert.match(update.sql, /due_at > DATE_ADD\(activity_at, INTERVAL \? HOUR\)/);
});

test('an unpaid Razorpay order sends its payment reminder instead of being treated as completed', async () => {
  state.job = job();
  state.pendingPayment = { order_id: 42, customer_name: 'Private customer', items: '[{"name":"Test item","price":100,"quantity":1}]', total: 149, amount: 149, token: 'order_pending_fixture' };
  await followups.runCartFollowupBatch();
  const completedCheck = state.reads.find(read => read.sql.includes('SELECT o.id'));
  assert.match(completedCheck.sql, /LOWER\(o.payment_method\) IN \('cod', 'cash on delivery'\)/);
  assert.match(completedCheck.sql, /FROM payments vp/);
  assert.match(completedCheck.sql, /FROM payment_status vps/);
  assert.doesNotMatch(completedCheck.sql, /o.status.*confirmed/);
  assert.equal(state.messages.length, 0);
  assert.equal(state.paymentMessages.length, 1);
  assert.equal(state.paymentMessages[0][1].orderId, '42');
  assert.match(state.paymentMessages[0][1].paymentUrl, /\/payment-status\/order_pending_fixture$/);
  assert.ok(state.writes.some(write => write.sql.includes("status = 'sent'")));
});

const snapshot = (cartItems = [], favoriteItems = []) => ({ source: 'saved_products', cartItems, favoriteItems });
const savedJob = () => ({ ...job(), items: JSON.stringify(snapshot([], [{ productId: 5, name: 'Old name', price: 1 }])) });

test('favorites-only capture queues current catalog details after three hours with separate consent scope', async () => {
  const result = await followups.captureEmailFollowup({
    email: 'recipient@example.invalid', customerName: 'Customer', userId: null, items: [],
    favoriteItems: [{ productId: 5, name: '<fake name>', price: 1, quantity: 100 }], reminderSource: 'saved_products',
    consent: { cartReminder: true, offerEmail: false, whatsappFollowup: false },
  });
  assert.equal(result.reminderScheduled, true);
  const insert = state.writes.find(write => write.sql.includes('INSERT INTO cart_reminder_jobs'));
  const stored = JSON.parse(insert.params[3]);
  assert.equal(insert.params[5], 3);
  assert.equal(stored.favoriteItems[0].name, 'Current catalog name');
  assert.equal(stored.favoriteItems[0].price, 125);
  assert.equal(stored.favoriteItems[0].quantity, 1);
  const preference = state.writes.find(write => write.sql.includes('INSERT INTO email_contact_preferences'));
  assert.ok(preference.params.includes('saved-products-v1'));
});

test('saved products reprice selected variants and packs, cap stock, and omit unavailable or duplicate favorites', async () => {
  state.products.push({ id: 6, name: 'Variant', price: 100, in_stock: 1, sizes: '["M","S"]', size_pricing: '[{"size":"M","price":150}]',
    attributes: '[{"slug":"material","terms":["Cotton"]}]', variant_pricing: '[{"selections":{"material":"Cotton","size":"M"},"price":175}]' },
    { id: 7, name: 'Unavailable', price: 100, in_stock: 0 });
  const result = await savedProducts.resolveSavedProducts(snapshot([
    { productId: 5, quantity: 20, price: 1 },
    { productId: 6, quantity: 1, selectedSize: 'M', selectedAttributes: { material: 'Cotton' } },
    { productId: 6, quantity: 1, selectedPieces: 3 },
    { productId: 6, quantity: 1, selectedSize: 'S' },
    { productId: 6, quantity: 1, selectedSize: 'Removed size' },
    { productId: 7, quantity: 1 }, { productId: 999, quantity: 1 },
  ], [{ productId: 5 }, { productId: 6 }, { productId: 7 }]));
  assert.equal(result.cartItems.length, 4);
  assert.equal(result.cartItems[0].quantity, 2);
  assert.equal(result.cartItems[0].price, 125);
  assert.equal(result.cartItems[1].price, 175);
  assert.equal(result.cartItems[2].price, 300);
  assert.equal(result.cartItems[3].price, 100);
  assert.deepEqual(result.favoriteItems, []);
});

test('worker sends a favorites-only reminder with current names, prices and unsubscribe link', async () => {
  state.job = savedJob(); state.consentVersion = 'saved-products-v1';
  await followups.runCartFollowupBatch();
  assert.equal(state.savedMessages.length, 1);
  const payload = state.savedMessages[0][1];
  assert.deepEqual(payload.cartItems, []);
  assert.equal(payload.favoriteItems[0].name, 'Current catalog name');
  assert.equal(payload.favoriteItems[0].price, 125);
  assert.match(payload.unsubscribeUrl, /#token=[a-f0-9]{64}$/);
  assert.match(payload.idempotencyKey, /^cart-reminder-1-/);
  assert.equal(state.messages.length + state.paymentMessages.length, 0);
});

test('older checkout consent never authorizes favorites reminders', async () => {
  state.job = savedJob();
  await followups.runCartFollowupBatch();
  assert.equal(state.savedMessages.length, 0);
  assert.ok(state.writes.some(write => write.sql.includes('Saved-product reminder consent is not active')));
});

test('worker uses the latest account lists and cancels if the customer has removed everything', async () => {
  state.job = { ...savedJob(), user_id: 12 }; state.consentVersion = 'saved-products-v1';
  state.accountItems = { cart_items: [{ productId: 5, quantity: 2 }], favorite_items: [] };
  await followups.runCartFollowupBatch();
  assert.equal(state.savedMessages[0][1].cartItems[0].quantity, 2);
  assert.deepEqual(state.savedMessages[0][1].favoriteItems, []);
  state.savedMessages = []; state.accountItems = { cart_items: [], favorite_items: [] };
  await followups.runCartFollowupBatch();
  assert.equal(state.savedMessages.length, 0);
  assert.ok(state.writes.some(write => write.sql.includes('No saved products remain available')));
});

test('unavailable favorites and completed orders do not send saved-product reminders', async () => {
  state.job = savedJob(); state.consentVersion = 'saved-products-v1'; state.products = [];
  await followups.runCartFollowupBatch();
  state.products = [{ id: 5, name: 'Product', price: 100, in_stock: 1 }]; state.completedOrder = true;
  await followups.runCartFollowupBatch();
  assert.equal(state.savedMessages.length, 0);
});

test('saved-product reminder sends only the pending payment email if an unpaid order exists', async () => {
  state.job = savedJob(); state.consentVersion = 'saved-products-v1';
  state.pendingPayment = { order_id: 42, items: '[{"name":"Ordered item","price":100,"quantity":1}]', amount: 149, token: 'pending-order' };
  await followups.runCartFollowupBatch();
  assert.equal(state.paymentMessages.length, 1);
  assert.equal(state.savedMessages.length, 0);
});

test('account cart and favorite changes queue only explicitly opted-in users, once for an identical snapshot', async () => {
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.equal(state.writes.length, 0);
  state.accountConsent = true; state.accountItems = { cart_items: [], favorite_items: [{ productId: 5 }] };
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  const inserts = () => state.writes.filter(write => write.sql.includes('INSERT INTO cart_reminder_jobs'));
  assert.equal(inserts().length, 1);
  assert.match(inserts()[0].sql, /INTERVAL 3 HOUR/);
  assert.equal(JSON.parse(inserts()[0].params[3]).favoriteItems.length, 1);
  state.existingSnapshot = true;
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.equal(inserts().length, 1);
});

test('an active checkout reminder takes precedence over account saved products', async () => {
  state.accountConsent = true; state.accountItems = { cart_items: [], favorite_items: [{ productId: 5 }] };
  state.activeJobs = [{ items: '[{"productId":5}]', status: 'pending' }];
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.equal(state.writes.length, 0);
});

test('returning to a previously cancelled unsent snapshot re-arms it without resending uncertain messages', async () => {
  state.accountConsent = true; state.accountItems = { cart_items: [], favorite_items: [{ productId: 5 }] };
  state.existingSnapshot = { status: 'cancelled', attempts: 0 };
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.ok(state.writes.some(write => write.sql.includes("SET status = 'pending', activity_at = NOW()")));
  state.writes = []; state.existingSnapshot = { status: 'uncertain', attempts: 1 };
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.ok(!state.writes.some(write => write.sql.includes("SET status = 'pending', activity_at = NOW()") || write.sql.includes('INSERT INTO cart_reminder_jobs')));
});

test('clearing both account lists cancels older saved-product reminders without queuing an empty email', async () => {
  state.accountConsent = true; state.accountItems = { cart_items: [], favorite_items: [] };
  await savedProducts.scheduleAccountSavedProductsReminder(12);
  assert.ok(state.writes.some(write => write.sql.includes('Saved products changed')));
  assert.ok(!state.writes.some(write => write.sql.includes('INSERT INTO cart_reminder_jobs')));
});
