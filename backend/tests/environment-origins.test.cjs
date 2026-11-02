const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isCorsOriginAllowed, resolveCorsOrigins, resolveSiteUrl } = require('../src/lib/environmentOrigins');

test('staging CORS uses only explicitly configured HTTPS origins', () => {
  const origins = resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: 'https://stage.example.invalid', CORS_ORIGIN: 'https://stage.example.invalid, https://preview.example.invalid' });
  assert.deepEqual(origins, ['https://stage.example.invalid', 'https://preview.example.invalid']);
  assert.equal(isCorsOriginAllowed('https://stage.example.invalid', origins, { APP_ENV: 'staging' }), true);
  assert.equal(isCorsOriginAllowed('https://www.brajmart.com', origins, { APP_ENV: 'staging' }), false);
  assert.equal(isCorsOriginAllowed('null', origins, { APP_ENV: 'staging' }), false);
  assert.equal(isCorsOriginAllowed(undefined, origins, { APP_ENV: 'staging' }), true);
});

test('staging CORS fails closed when no exact origin is configured', () => {
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: 'https://stage.example.invalid' }, ['https://www.brajmart.com']), /CORS_ORIGIN must explicitly list/);
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', CORS_ORIGIN: 'https://stage.example.invalid' }), /FRONTEND_URL is required/);
});

test('staging CORS rejects HTTP, paths, and production origins', () => {
  const frontend = 'https://stage.example.invalid';
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: frontend, CORS_ORIGIN: 'http://stage.example.invalid' }), /HTTPS origins/);
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: frontend, CORS_ORIGIN: 'https://stage.example.invalid/path' }), /HTTPS origins/);
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: frontend, CORS_ORIGIN: 'https://www.brajmart.com' }), /production BrajMart origin/);
});

test('staging CORS rejects a list that omits the configured frontend origin', () => {
  assert.throws(() => resolveCorsOrigins({ APP_ENV: 'staging', FRONTEND_URL: 'https://stage.example.invalid', CORS_ORIGIN: 'https://preview.example.invalid' }), /must include the configured staging FRONTEND_URL/);
});

test('staging SITE_URL must be explicit and cannot point to production', () => {
  assert.throws(() => resolveSiteUrl({ APP_ENV: 'staging' }), /SITE_URL is required/);
  assert.throws(() => resolveSiteUrl({ APP_ENV: 'staging', SITE_URL: 'https://www.brajmart.com' }), /production BrajMart origin/);
  assert.equal(resolveSiteUrl({ APP_ENV: 'staging', SITE_URL: 'https://stage.example.invalid/' }), 'https://stage.example.invalid');
});

test('non-staging origin and site defaults preserve existing behavior', () => {
  assert.deepEqual(resolveCorsOrigins({ CORS_ORIGIN: 'https://custom.example.invalid' }, ['https://www.brajmart.com']), [
    'https://www.brajmart.com', 'https://custom.example.invalid',
  ]);
  assert.equal(resolveSiteUrl({}), 'https://www.brajmart.com');
  assert.equal(isCorsOriginAllowed('null', [], { APP_ENV: 'production' }), true);
});

