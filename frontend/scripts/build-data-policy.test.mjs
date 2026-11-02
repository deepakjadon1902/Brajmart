import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { isStrictSeoBuild } from './build-data-policy.mjs';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test('catalog builds are strict by default', () => {
  assert.equal(isStrictSeoBuild({}), true);
  assert.equal(isStrictSeoBuild({ SEO_STRICT_BUILD: 'true' }), true);
  assert.equal(isStrictSeoBuild({ SEO_STRICT_BUILD: 'unexpected' }), true);
});

test('local fallback requires the explicit false opt-out', () => {
  assert.equal(isStrictSeoBuild({ SEO_STRICT_BUILD: 'false' }), false);
  assert.equal(isStrictSeoBuild({ SEO_STRICT_BUILD: 'FALSE' }), false);
});

test('Vercel production and preview builds cannot opt out of catalog validation', () => {
  assert.equal(isStrictSeoBuild({ VERCEL: '1', SEO_STRICT_BUILD: 'false' }), true);
  assert.equal(isStrictSeoBuild({ VERCEL_ENV: 'production', SEO_STRICT_BUILD: 'false' }), true);
  assert.equal(isStrictSeoBuild({ VERCEL_ENV: 'preview', SEO_STRICT_BUILD: 'false' }), true);
});

test('CI builds cannot opt out of catalog validation', () => {
  assert.equal(isStrictSeoBuild({ CI: '1', SEO_STRICT_BUILD: 'false' }), true);
  assert.equal(isStrictSeoBuild({ CI: 'true', SEO_STRICT_BUILD: 'false' }), true);
});

test('strict release catalog failure rejects instead of returning empty product/category data', async () => {
  process.env.BUILD_API_BASE_URL = 'https://catalog-check.invalid/api';
  process.env.BUILD_API_RETRIES = '0';
  process.env.BUILD_API_READY_TIMEOUT_MS = '1000';
  process.env.VERCEL = '1';
  process.env.SEO_STRICT_BUILD = 'false';
  globalThis.fetch = async () => new Response('catalog unavailable', { status: 500 });
  const { getBuildData } = await import(`./build-data.mjs?strict-check=${Date.now()}`);

  await assert.rejects(getBuildData(), /release build stopped to prevent publishing incomplete catalog HTML/);
});
