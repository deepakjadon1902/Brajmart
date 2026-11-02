const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../src/lib/db');
const { getJwtSecret } = require('../src/middleware/auth');
let state;
db.isDbConnected = () => true;
db.dbQuery = async sql => {
  db.assertNoRuntimeDdl(sql);
  if (state.fail) throw new Error('Test database unavailable');
  assert.match(sql, /FROM settings/);
  return [{ ...state.row }];
};
db.dbExecute = async (sql, params = []) => {
  db.assertNoRuntimeDdl(sql);
  if (sql.includes('UPDATE settings')) {
    state.writes++;
    const columns = [...sql.matchAll(/(\w+) = \?/g)].map(match => match[1]);
    columns.forEach((column, index) => { if (column !== 'id') state.row[column] = params[index]; });
  }
  return { affectedRows: 1 };
};
const app = express();
app.use(express.json());
app.use('/api/settings', require('../src/routes/settings').default);
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/settings`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { state = { row: { id: 1, store_name: 'BrajMart', announcement_bar: JSON.stringify({ enabled: false, messages: ['Original announcement'] }) }, writes: 0 }; });
const headers = (role = 'admin') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: '8', role }, getJwtSecret())}` });
const save = (body, role = 'admin') => fetch(base, { method: 'PUT', headers: headers(role), body: JSON.stringify(body) });
const fresh = () => fetch(`${base}?fresh=1`);

test('legacy settings default to decorations off without modifying the database', async () => {
  const response = await fresh();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).festivalTheme, 'none');
  assert.equal(state.writes, 0);
});

test('Diwali, Holi and off persist through the public settings API independently of announcements', async () => {
  for (const theme of ['diwali', 'holi', 'none']) {
    const response = await save({ festivalTheme: theme });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).festivalTheme, theme);
    const settings = await (await fresh()).json();
    assert.equal(settings.festivalTheme, theme);
    assert.equal(settings.announcementBar.enabled, false);
    assert.deepEqual(settings.announcementBar.messages, ['Original announcement']);
    const cached = await (await fetch(base)).json();
    assert.equal(cached.festivalTheme, theme);
  }
});

test('saving other settings and announcements preserves the active festival', async () => {
  await save({ festivalTheme: 'diwali' });
  const response = await save({ storeName: 'Updated store', announcementBar: { enabled: true, messages: ['Updated announcement'], festivalTheme: 'holi' } });
  const settings = await response.json();
  assert.equal(settings.festivalTheme, 'diwali');
  assert.equal(settings.storeName, 'Updated store');
  assert.deepEqual(settings.announcementBar.messages, ['Updated announcement']);
});

test('invalid festival selections are rejected without a write', async () => {
  for (const festivalTheme of ['christmas', '', null, {}, ['holi'], 1]) {
    const response = await save({ festivalTheme });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /none, diwali, or holi/);
  }
  assert.equal(state.writes, 0);
});

test('only authenticated administrators may change the storefront festival', async () => {
  assert.equal((await fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"festivalTheme":"diwali"}' })).status, 401);
  assert.equal((await save({ festivalTheme: 'holi' }, 'user')).status, 403);
  assert.equal(state.writes, 0);
});

test('database failures do not report a successful theme change', async () => {
  state.fail = true;
  assert.equal((await save({ festivalTheme: 'diwali' })).status, 500);
  assert.equal(state.writes, 0);
});
