const assert = require('node:assert/strict');
const { test } = require('node:test');
const { adminOrderFilterSql } = require('../src/lib/adminOrderFilters');

test('date range covers both full India calendar days with UTC database bounds', () => {
  const result = adminOrderFilterSql({ dateFrom: '2026-11-01', dateTo: '2026-11-03' });
  assert.match(result.sql, /created_at >= \? AND created_at < \?/);
  const [start, end] = result.params.map((date) => date.toISOString());
  assert.equal(start, '2026-10-31T18:30:00.000Z');
  assert.equal(end, '2026-11-03T18:30:00.000Z');
  for (const [date, included] of [
    ['2026-10-31T18:29:59.999Z', false], ['2026-10-31T18:30:00Z', true],
    ['2026-11-03T18:29:59.999Z', true], ['2026-11-03T18:30:00Z', false],
  ]) assert.equal(new Date(date) >= result.params[0] && new Date(date) < result.params[1], included, date);
});

test('open-ended and single-day ranges preserve inclusive India dates', () => {
  assert.equal(adminOrderFilterSql({ dateFrom: '2026-11-01' }).params.length, 1);
  assert.equal(adminOrderFilterSql({ dateTo: '2026-11-01' }).params[0].toISOString(), '2026-11-01T18:30:00.000Z');
  const single = adminOrderFilterSql({ dateFrom: '2026-11-01', dateTo: '2026-11-01' }).params;
  assert.equal(single[1] - single[0], 86_400_000);
});

test('customer, search and multiple statuses combine using bound literal values', () => {
  const result = adminOrderFilterSql({ search: "  O'Neil  ", customer: ' A_%! ', status: 'shipped,delivered,shipped' });
  assert.match(result.sql, /JSON_EXTRACT/);
  assert.match(result.sql, /status IN \(\?,\?\)/);
  assert.ok(!result.sql.includes("O'Neil"));
  assert.deepEqual(result.params, [...Array(8).fill("%o'neil%"), '%a!_!%!!%', 'shipped', 'delivered']);
});

test('bad dates, reversed ranges, unknown statuses and structured query values return 400', () => {
  for (const query of [
    { dateFrom: '2026-02-30' }, { dateTo: '2026-13-01' }, { dateTo: 'not-a-date' },
    { dateFrom: '2026-11-03', dateTo: '2026-11-01' }, { status: 'shipped,unknown' },
    { search: ['one', 'two'] }, { customer: { name: 'Paul' } }, { dateFrom: '0000-01-01' },
  ]) assert.throws(() => adminOrderFilterSql(query), (error) => error.status === 400);
});

test('unfiltered exports exclude pagination from the filter contract', () => {
  assert.deepEqual(adminOrderFilterSql({ page: '3', limit: '10', status: 'all' }), { sql: '', params: [] });
});
