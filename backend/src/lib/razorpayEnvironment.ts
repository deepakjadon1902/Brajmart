export type RazorpayMode = 'test' | 'live';
export type RazorpayCredentials = {
  mode: RazorpayMode;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

const value = (env: NodeJS.ProcessEnv, key: string) => String(env[key] ?? '').trim();
const hasAny = (env: NodeJS.ProcessEnv, keys: string[]) => keys.some((key) => Boolean(value(env, key)));

/**
 * Resolve one environment-specific Razorpay credential set. Staging and
 * development only read the dedicated test variables. Production only reads
 * the existing live variables. Unknown or mixed environments fail closed.
 */
export const resolveRazorpayCredentials = (env: NodeJS.ProcessEnv = process.env): RazorpayCredentials => {
  const appEnv = value(env, 'APP_ENV').toLowerCase();
  const nodeEnv = value(env, 'NODE_ENV').toLowerCase();
  const mode = value(env, 'RAZORPAY_MODE').toLowerCase();
  const productionKeys = [
    'RAZORPAY_PLATFORM_KEY_ID', 'RAZORPAY_PLATFORM_KEY_SECRET', 'RAZORPAY_PLATFORM_WEBHOOK_SECRET',
    'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  ];
  const testKeys = ['RAZORPAY_TEST_KEY_ID', 'RAZORPAY_TEST_KEY_SECRET', 'RAZORPAY_TEST_WEBHOOK_SECRET'];

  if (appEnv === 'staging' || appEnv === 'development' || appEnv === 'dev') {
    if (nodeEnv === 'production' && appEnv !== 'staging') throw new Error('Razorpay environment mismatch');
    if (appEnv === 'staging' && nodeEnv !== 'production') throw new Error('Staging Razorpay requires production runtime mode');
    if (mode !== 'test' || hasAny(env, productionKeys)) throw new Error('Razorpay test-mode configuration rejected');
    const keyId = value(env, 'RAZORPAY_TEST_KEY_ID');
    const keySecret = value(env, 'RAZORPAY_TEST_KEY_SECRET');
    const webhookSecret = value(env, 'RAZORPAY_TEST_WEBHOOK_SECRET');
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || !keySecret || !webhookSecret) {
      throw new Error('Razorpay test credentials are incomplete or invalid');
    }
    return { mode: 'test', keyId, keySecret, webhookSecret };
  }

  if (appEnv === 'production') {
    if (nodeEnv !== 'production' || mode !== 'live' || hasAny(env, testKeys)) {
      throw new Error('Razorpay production environment mismatch');
    }
    const keyId = value(env, 'RAZORPAY_PLATFORM_KEY_ID') || value(env, 'RAZORPAY_KEY_ID');
    const keySecret = value(env, 'RAZORPAY_PLATFORM_KEY_SECRET') || value(env, 'RAZORPAY_KEY_SECRET');
    const webhookSecret = value(env, 'RAZORPAY_PLATFORM_WEBHOOK_SECRET') || value(env, 'RAZORPAY_WEBHOOK_SECRET');
    if (!/^rzp_live_[A-Za-z0-9]+$/.test(keyId) || !keySecret) {
      throw new Error('Razorpay live credentials are incomplete or invalid');
    }
    return { mode: 'live', keyId, keySecret, webhookSecret };
  }

  throw new Error('Razorpay APP_ENV is unknown; payment operations are disabled');
};
