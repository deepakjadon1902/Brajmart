const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const db = require('../src/lib/db');
const audit = require('../src/lib/adminAudit');
let state;
const products = [
  { id: 101, name: 'Contract product A', slug: 'contract-a', price: 100, image: '/placeholder.svg', in_stock: 1 },
  { id: 102, name: 'Contract product B', slug: 'contract-b', price: 80, image: '/placeholder.svg', in_stock: 1 },
];
db.dbQuery = async (sql, params = []) => {
  assert.match(sql.trim(), /^SELECT\b/);
  state.queries.push({ sql, params });
  if (sql.includes('WHERE p.id IN')) return products.filter(product => params.includes(product.id) && state.availableIds.includes(product.id));
  if (sql.includes('WHERE p.id = ?')) return [];
  throw new Error(`Unexpected commerce query: ${sql}`);
};
db.dbExecute = async () => { throw new Error('Direct schema writes are forbidden in this contract test'); };
db.withDbTransaction = async operation => {
  state.transactions++;
  return operation({ execute: async (sql, params) => {
    assert.doesNotMatch(sql.trim(), /^(?:CREATE|ALTER|DROP)\b/i);
    state.statements.push({ sql, params });
    if (sql.startsWith('SELECT')) return [[{ id: 50, name: 'Contract bundle', slug: 'contract-bundle' }]];
    return [{ insertId: 50, affectedRows: 1 }];
  } });
};
audit.insertAdminAuditLog = async (_connection, entry) => { state.audits.push(entry); };
const commerce = require('../src/lib/commerceIntelligence');
beforeEach(() => {
  state = { availableIds: [101, 102], queries: [], statements: [], audits: [], transactions: 0 };
  commerce.clearCommerceIntelligenceCache();
});
const request = body => ({ body, user: { id: '17', email: 'admin-contract@example.invalid', role: 'admin' } });

test('invalid bundle bodies fail validation before any transaction or audit write', async () => {
  for (const body of [{}, { name: 'Contract bundle', productIds: [101] }, { name: 'Contract bundle', productIds: [101, 101] }]) {
    assert.equal((await commerce.createBundle(request(body))).ok, false);
  }
  assert.equal(state.transactions, 0);
  assert.equal(state.statements.length, 0);
  assert.equal(state.audits.length, 0);
});

test('unavailable bundle products remain rejected before persistence', async () => {
  state.availableIds = [101];
  const result = await commerce.createBundle(request({ name: 'Contract bundle', productIds: [101, 102] }));
  assert.equal(result.ok, false);
  assert.match(result.message, /unavailable/);
  assert.equal(state.transactions, 0);
});

test('bundle creation preserves AuthRequest body fields and authenticated audit identity', async () => {
  const req = request({ name: 'Contract bundle', productIds: [101, 102], sku: 'CONTRACT', startsAt: '2026-11-01', endsAt: '2026-11-30' });
  assert.deepEqual(await commerce.createBundle(req), { ok: true, bundleId: 50 });
  const insert = state.statements.find(entry => entry.sql.startsWith('INSERT INTO bundles'));
  assert.equal(insert.params[0], 'Contract bundle');
  assert.deepEqual(insert.params.slice(-4), ['2026-11-01', '2026-11-30', req.user.email, req.user.email]);
  assert.equal(state.statements.filter(entry => entry.sql.startsWith('INSERT INTO bundle_products')).length, 2);
  assert.equal(state.audits[0].action, 'BUNDLE_CREATE');
  assert.equal(state.audits[0].req.user.id, '17');
});

test('bundle updates retain partial body mapping and authenticated editor identity', async () => {
  const req = request({ description: 'Updated contract description' });
  assert.deepEqual(await commerce.updateBundle(req, 50), { ok: true, bundleId: 50 });
  const update = state.statements.find(entry => entry.sql.startsWith('UPDATE bundles'));
  assert.deepEqual(update.params, ['Updated contract description', req.user.email, 50]);
  assert.doesNotMatch(update.sql, /name =/);
  assert.equal(state.audits[0].action, 'BUNDLE_UPDATE');
});

test('bundle activation and archival retain the actor and supplied reason', async () => {
  const req = request({});
  assert.deepEqual(await commerce.setBundleActive(req, 50, true), { ok: true });
  assert.deepEqual(state.statements.find(entry => entry.sql.startsWith('UPDATE bundles')).params, [1, req.user.email, 50]);
  assert.deepEqual(await commerce.archiveBundle(req, 50, 'Reviewed contract archival'), { ok: true });
  const updates = state.statements.filter(entry => entry.sql.startsWith('UPDATE bundles'));
  assert.deepEqual(updates[1].params, [req.user.email, 'Reviewed contract archival', req.user.email, 50]);
  assert.deepEqual(state.audits.map(entry => entry.action), ['BUNDLE_ACTIVATE', 'BUNDLE_DELETE']);
});

test('missing product recommendations cache their existing response and invalidate correctly', async () => {
  const expected = { productId: '999', sections: [], recommendations: [] };
  assert.deepEqual(await commerce.getProductRecommendations(999), expected);
  assert.deepEqual(await commerce.getProductRecommendations(999), expected);
  assert.equal(state.queries.length, 1);
  commerce.clearCommerceIntelligenceCache();
  assert.deepEqual(await commerce.getProductRecommendations(999), expected);
  assert.equal(state.queries.length, 2);
});
