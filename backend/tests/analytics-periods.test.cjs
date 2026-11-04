const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getPeriodStart, addPeriod, getBucketKey, getRangeLabel, inDateRange } = require('../src/lib/analyticsPeriods');

const now = new Date('2026-11-04T07:00:00Z');
for (const [period, expected] of Object.entries({
  daily: '2026-11-03T18:30:00.000Z',
  weekly: '2026-11-01T18:30:00.000Z',
  monthly: '2026-10-31T18:30:00.000Z',
  quarterly: '2026-09-30T18:30:00.000Z',
  yearly: '2025-12-31T18:30:00.000Z',
})) {
  test(`${period} starts at the correct India calendar boundary`, () => {
    const start = getPeriodStart(now, period);
    assert.equal(start.toISOString(), expected);
    assert.equal(inDateRange(new Date(start.getTime() - 1), start, now), false);
    assert.equal(inDateRange(start, start, now), true);
    assert.equal(inDateRange(now, start, now), true);
    assert.equal(inDateRange(new Date(now.getTime() + 1), start, now), false);
  });
}

test('India midnight rolls into the next month, quarter and year before UTC midnight', () => {
  const rollover = new Date('2026-12-31T18:30:00Z');
  for (const period of ['daily', 'monthly', 'quarterly', 'yearly']) {
    assert.equal(getPeriodStart(rollover, period).toISOString(), rollover.toISOString());
  }
  assert.equal(getBucketKey(rollover, 'daily'), '2027-01-01');
  assert.equal(getBucketKey(rollover, 'monthly'), '2027-01');
  assert.equal(getBucketKey(rollover, 'quarterly'), '2027-Q1');
  assert.equal(getBucketKey(rollover, 'yearly'), '2027');
  assert.equal(getRangeLabel(rollover, rollover), '01 Jan 2027');
});

test('weeks run Monday through Sunday in India across a year boundary', () => {
  const sunday = new Date('2027-01-03T18:29:59.999Z');
  const monday = new Date('2027-01-03T18:30:00Z');
  assert.equal(getBucketKey(sunday, 'weekly'), '2026-12-28');
  assert.equal(getBucketKey(monday, 'weekly'), '2027-01-04');
});

test('calendar stepping handles leap days and quarter/year changes', () => {
  const february = getPeriodStart(new Date('2028-02-15T00:00:00Z'), 'monthly');
  assert.equal(addPeriod(february, 'monthly', 1).toISOString(), '2028-02-29T18:30:00.000Z');
  const quarter = getPeriodStart(new Date('2026-11-04T07:00:00Z'), 'quarterly');
  assert.equal(addPeriod(quarter, 'quarterly', 1).toISOString(), '2026-12-31T18:30:00.000Z');
  assert.equal(addPeriod(getPeriodStart(now, 'yearly'), 'yearly', 1).toISOString(), '2026-12-31T18:30:00.000Z');
});
