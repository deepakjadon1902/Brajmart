const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  resolveRazorpayCredentials,
  inspectRazorpayConfiguration,
  RazorpayConfigurationError,
} = require('../src/lib/razorpayEnvironment');
const {
  verifyCapturedRazorpayPaymentWithOptions,
} = require('../src/lib/razorpayVerification');

const stagingEnv = (overrides = {}) => ({
  APP_ENV: 'staging',
  NODE_ENV: 'production',
  RAZORPAY_MODE: 'test',
  RAZORPAY_TEST_KEY_ID: 'rzp_test_StagingOnly',
  RAZORPAY_TEST_KEY_SECRET: 'isolated-test-secret',
  RAZORPAY_TEST_WEBHOOK_SECRET: 'isolated-test-webhook-secret',
  ...overrides,
});

const liveEnv = (overrides = {}) => ({
  APP_ENV: 'production',
  NODE_ENV: 'production',
  RAZORPAY_MODE: 'live',
  RAZORPAY_PLATFORM_KEY_ID: 'rzp_live_ProductionOnly',
  RAZORPAY_PLATFORM_KEY_SECRET: 'isolated-live-secret',
  RAZORPAY_PLATFORM_WEBHOOK_SECRET: 'isolated-live-webhook-secret',
  ...overrides,
});

test('staging resolves only its dedicated test key pair and test webhook secret', () => {
  assert.deepEqual(resolveRazorpayCredentials(stagingEnv()), {
    mode: 'test',
    keyId: 'rzp_test_StagingOnly',
    keySecret: 'isolated-test-secret',
    webhookSecret: 'isolated-test-webhook-secret',
  });
});

test('staging rejects live key IDs and any populated production credential namespace', () => {
  assert.throws(() => resolveRazorpayCredentials(stagingEnv({ RAZORPAY_TEST_KEY_ID: 'rzp_live_WrongMode' })), /test credentials/);
  assert.throws(() => resolveRazorpayCredentials(stagingEnv({ RAZORPAY_PLATFORM_KEY_ID: 'rzp_live_ProductionOnly' })), /test-mode/);
  assert.throws(() => resolveRazorpayCredentials(stagingEnv({ RAZORPAY_MODE: 'live' })), /test-mode/);
});

test('production accepts only explicitly selected live credentials and rejects test credentials', () => {
  assert.equal(resolveRazorpayCredentials(liveEnv()).mode, 'live');
  assert.throws(() => resolveRazorpayCredentials(liveEnv({ RAZORPAY_MODE: 'test' })), /environment mismatch/);
  assert.throws(() => resolveRazorpayCredentials(liveEnv({ RAZORPAY_PLATFORM_KEY_ID: 'rzp_test_TestOnly' })), /live credentials/);
  assert.throws(() => resolveRazorpayCredentials(liveEnv({ RAZORPAY_TEST_KEY_ID: 'rzp_test_TestOnly' })), /environment mismatch/);
});

test('the reported production failure identifies both missing flags without guessing a mode', () => {
  const env = liveEnv({ NODE_ENV: undefined, RAZORPAY_MODE: undefined });
  assert.throws(() => resolveRazorpayCredentials(env), error => {
    assert.ok(error instanceof RazorpayConfigurationError);
    assert.equal(error.message, 'Razorpay production environment mismatch');
    assert.deepEqual(error.issues.map(issue => issue.setting), ['NODE_ENV', 'RAZORPAY_MODE']);
    return true;
  });
  assert.equal(inspectRazorpayConfiguration(env).checkoutReady, false);
  Object.assign(env, { NODE_ENV: 'production', RAZORPAY_MODE: 'live' });
  assert.deepEqual(inspectRazorpayConfiguration(env), {
    checkoutReady: true, webhookReady: true, mode: 'live', code: 'CONFIGURED', issues: [],
  });
});

test('configuration reports identify mixed namespaces and never echo supplied values or secrets', () => {
  const sentinel = 'PRIVATE_VALUE_DO_NOT_LOG';
  for (const env of [
    liveEnv({ NODE_ENV: sentinel, RAZORPAY_MODE: sentinel, RAZORPAY_TEST_KEY_SECRET: sentinel }),
    liveEnv({ RAZORPAY_PLATFORM_KEY_ID: sentinel, RAZORPAY_PLATFORM_KEY_SECRET: '' }),
    stagingEnv({ RAZORPAY_PLATFORM_KEY_SECRET: sentinel }),
    stagingEnv({ RAZORPAY_TEST_KEY_ID: sentinel }),
    liveEnv({ APP_ENV: sentinel }),
    liveEnv(), stagingEnv(),
  ]) {
    const report = inspectRazorpayConfiguration(env);
    const serialized = JSON.stringify(report);
    for (const forbidden of [sentinel, 'rzp_live_ProductionOnly', 'rzp_test_StagingOnly', 'isolated-live-secret', 'isolated-live-webhook-secret', 'isolated-test-secret']) {
      assert.equal(serialized.includes(forbidden), false);
    }
  }
  const mixed = inspectRazorpayConfiguration(liveEnv({ RAZORPAY_TEST_KEY_SECRET: sentinel }));
  assert.deepEqual(mixed.issues.map(issue => issue.setting), ['RAZORPAY_TEST_KEY_SECRET']);
  assert.equal(mixed.checkoutReady, false);
});

test('a missing live webhook secret is reported separately from checkout readiness', () => {
  const report = inspectRazorpayConfiguration(liveEnv({ RAZORPAY_PLATFORM_WEBHOOK_SECRET: '' }));
  assert.equal(report.checkoutReady, true);
  assert.equal(report.webhookReady, false);
  assert.deepEqual(report.issues.map(issue => issue.setting), ['RAZORPAY_PLATFORM_WEBHOOK_SECRET']);
});

test('the example production configuration includes the mandatory environment flags', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dotenv = require('dotenv');
  const example = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.example')));
  assert.equal(example.APP_ENV, 'production');
  assert.equal(example.NODE_ENV, 'production');
  assert.equal(example.RAZORPAY_MODE, 'live');
  // Supply isolated fixtures only: the example must never contain real keys.
  assert.equal(example.RAZORPAY_PLATFORM_KEY_ID, '');
  const report = inspectRazorpayConfiguration({ ...example, ...Object.fromEntries(Object.entries(liveEnv()).filter(([key]) => key.startsWith('RAZORPAY_PLATFORM_'))) });
  assert.equal(report.checkoutReady, true);
  assert.equal(report.webhookReady, true);
});

test('unknown environments, unknown mode, and runtime/environment mismatch fail closed', () => {
  assert.throws(() => resolveRazorpayCredentials({ ...stagingEnv(), APP_ENV: 'preview' }), /unknown/);
  assert.throws(() => resolveRazorpayCredentials(stagingEnv({ RAZORPAY_MODE: 'sandbox' })), /test-mode/);
  assert.throws(() => resolveRazorpayCredentials({ ...liveEnv(), NODE_ENV: 'development' }), /environment mismatch/);
  assert.throws(() => resolveRazorpayCredentials({ ...stagingEnv(), NODE_ENV: 'test' }), /production runtime/);
});

test('missing staging test credentials, missing production live credentials, and missing APP_ENV all fail closed', () => {
  assert.throws(() => resolveRazorpayCredentials({ APP_ENV: 'staging', NODE_ENV: 'production', RAZORPAY_MODE: 'test' }), /test credentials are incomplete/);
  assert.throws(() => resolveRazorpayCredentials({ APP_ENV: 'production', NODE_ENV: 'production', RAZORPAY_MODE: 'live' }), /live credentials are incomplete/);
  assert.throws(() => resolveRazorpayCredentials({ NODE_ENV: 'production', RAZORPAY_MODE: 'test' }), /APP_ENV is unknown/);
});

test('captured test payment verification uses only a mocked request with staging test credentials', async () => {
  const request = [];
  const result = await verifyCapturedRazorpayPaymentWithOptions({
    orderId: 'order_Test42', paymentId: 'pay_Test42', amount: 42, liveOnly: false,
  }, {
    env: stagingEnv(),
    fetcher: async (url, options) => {
      request.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          id: 'pay_Test42', order_id: 'order_Test42', status: 'captured', captured: true,
          currency: 'INR', amount: 4200, amount_refunded: 0,
        }),
      };
    },
  });
  assert.equal(result.id, 'pay_Test42');
  assert.equal(request.length, 1);
  assert.match(request[0].url, /^https:\/\/api\.razorpay\.com\/v1\/payments\/pay_Test42$/);
  assert.equal(request[0].options.headers.Authorization,
    `Basic ${Buffer.from('rzp_test_StagingOnly:isolated-test-secret').toString('base64')}`);
});

test('production-only purchase verification rejects staging before calling any provider', async () => {
  let calls = 0;
  await assert.rejects(verifyCapturedRazorpayPaymentWithOptions({
    orderId: 'order_Test42', paymentId: 'pay_Test42', amount: 42, liveOnly: true,
  }, {
    env: stagingEnv(),
    fetcher: async () => { calls += 1; throw new Error('provider should not be called'); },
  }), /live-mode/);
  assert.equal(calls, 0);
});
