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

test('configured frontend and CORS origins are normalized and deduplicated', () => {
  const env = {
    APP_ENV: 'production',
    FRONTEND_URL: 'https://Frontend.example.invalid/',
    CORS_ORIGIN: ' https://preview.example.invalid:443/, https://frontend.example.invalid ',
  };
  const origins = resolveCorsOrigins(env, ['https://preview.example.invalid']);
  assert.deepEqual(origins, ['https://preview.example.invalid', 'https://frontend.example.invalid']);
  assert.equal(isCorsOriginAllowed('https://frontend.example.invalid', origins, env), true);
  assert.equal(isCorsOriginAllowed('https://preview.example.invalid', origins, env), true);
});

const vercelEnv = {
  APP_ENV: 'production',
  CORS_VERCEL_PROJECT: 'brajmart',
  CORS_VERCEL_SCOPE: 'ibrajmarts-projects',
};
const deploymentOrigin = 'https://brajmart-cv48hs1e2-ibrajmarts-projects.vercel.app';

test('Vercel deployment hashes and branch aliases require an explicit project and scope', () => {
  for (const origin of [deploymentOrigin, 'https://brajmart-next12345-ibrajmarts-projects.vercel.app', 'https://brajmart-git-main-ibrajmarts-projects.vercel.app', 'https://brajmart-git-fix-cors-ibrajmarts-projects.vercel.app']) {
    assert.equal(isCorsOriginAllowed(origin, [], vercelEnv), true, origin);
  }
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [], {}), false);
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [], { CORS_VERCEL_PROJECT: 'brajmart' }), false);
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [], { CORS_VERCEL_SCOPE: 'ibrajmarts-projects' }), false);
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [], { ...vercelEnv, CORS_VERCEL_PROJECT: '*' }), false);
});

test('Vercel preview access rejects unrelated hosts and malformed origins', () => {
  for (const origin of [
    'https://other-cv48hs1e2-ibrajmarts-projects.vercel.app',
    'https://brajmart-cv48hs1e2-other-projects.vercel.app',
    'https://brajmart-other-cv48hs1e2-ibrajmarts-projects.vercel.app',
    'https://brajmart-ibrajmarts-projects.vercel.app',
    'https://brajmart--ibrajmarts-projects.vercel.app',
    `${deploymentOrigin}.evil.invalid`,
    `${deploymentOrigin}:8443`,
    `${deploymentOrigin}/`,
    `${deploymentOrigin}/path`,
    `${deploymentOrigin}?query=1`,
    `${deploymentOrigin}#fragment`,
    deploymentOrigin.replace('https:', 'http:'),
    deploymentOrigin.replace('https://', 'https://user:password@'),
    `https://brajmart-${'a'.repeat(64)}-ibrajmarts-projects.vercel.app`,
    'not a URL',
  ]) {
    assert.equal(isCorsOriginAllowed(origin, [], vercelEnv), false, origin);
  }
});

test('Vercel settings never broaden staging access', () => {
  const env = { ...vercelEnv, APP_ENV: 'staging' };
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [], env), false);
  assert.equal(isCorsOriginAllowed(deploymentOrigin, [deploymentOrigin], env), true);
  assert.equal(isCorsOriginAllowed(undefined, [], env), true);
  assert.equal(isCorsOriginAllowed('null', [], env), false);
});

test('configured paths and credentials do not grant access to their base origin', () => {
  const env = { CORS_ORIGIN: 'https://preview.example.invalid/path,https://user:password@other.example.invalid' };
  const origins = resolveCorsOrigins(env);
  assert.equal(isCorsOriginAllowed('https://preview.example.invalid', origins, env), false);
  assert.equal(isCorsOriginAllowed('https://other.example.invalid', origins, env), false);
  assert.equal(isCorsOriginAllowed(undefined, [], env), true);
});

