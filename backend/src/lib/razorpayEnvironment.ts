export type RazorpayMode = 'test' | 'live';
export type RazorpayCredentials = {
  mode: RazorpayMode;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

const value = (env: NodeJS.ProcessEnv, key: string) => String(env[key] ?? '').trim();
export type RazorpayConfigurationIssue = { setting: string; action: string };

// Only setting names and fixed instructions may enter diagnostics. Never include
// supplied values, credentials, request bodies or provider responses.
export class RazorpayConfigurationError extends Error {
  readonly code = 'RAZORPAY_CONFIGURATION_INVALID';
  constructor(message: string, readonly issues: RazorpayConfigurationIssue[]) {
    super(message);
    this.name = 'RazorpayConfigurationError';
  }
}

const populatedIssues = (env: NodeJS.ProcessEnv, keys: string[]) => keys
  .filter((key) => Boolean(value(env, key)))
  .map((setting) => ({ setting, action: 'Remove this variable from this service; do not mix test and live credentials.' }));

const requiredValueIssue = (env: NodeJS.ProcessEnv, setting: string, expected: string) =>
  value(env, setting).toLowerCase() === expected ? [] : [{ setting, action: `Set ${setting}=${expected} on the backend service.` }];

/**
 * Resolve one environment-specific Razorpay credential set. Staging and
 * development only read the dedicated test variables. Production only reads
 * the existing live variables. Unknown or mixed environments fail closed.
 */
export const resolveRazorpayCredentials = (env: NodeJS.ProcessEnv = process.env): RazorpayCredentials => {
  const appEnv = value(env, 'APP_ENV').toLowerCase();
  const nodeEnv = value(env, 'NODE_ENV').toLowerCase();
  const productionKeys = [
    'RAZORPAY_PLATFORM_KEY_ID', 'RAZORPAY_PLATFORM_KEY_SECRET', 'RAZORPAY_PLATFORM_WEBHOOK_SECRET',
    'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
  ];
  const testKeys = ['RAZORPAY_TEST_KEY_ID', 'RAZORPAY_TEST_KEY_SECRET', 'RAZORPAY_TEST_WEBHOOK_SECRET'];

  if (appEnv === 'staging' || appEnv === 'development' || appEnv === 'dev') {
    if (nodeEnv === 'production' && appEnv !== 'staging') {
      throw new RazorpayConfigurationError('Razorpay environment mismatch', [{ setting: 'NODE_ENV', action: 'Use NODE_ENV=development for a development backend; staging uses APP_ENV=staging and NODE_ENV=production.' }]);
    }
    if (appEnv === 'staging' && nodeEnv !== 'production') {
      throw new RazorpayConfigurationError('Staging Razorpay requires production runtime mode', requiredValueIssue(env, 'NODE_ENV', 'production'));
    }
    const issues = [...requiredValueIssue(env, 'RAZORPAY_MODE', 'test'), ...populatedIssues(env, productionKeys)];
    if (issues.length) throw new RazorpayConfigurationError('Razorpay test-mode configuration rejected', issues);
    const keyId = value(env, 'RAZORPAY_TEST_KEY_ID');
    const keySecret = value(env, 'RAZORPAY_TEST_KEY_SECRET');
    const webhookSecret = value(env, 'RAZORPAY_TEST_WEBHOOK_SECRET');
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || !keySecret || !webhookSecret) {
      const issues: RazorpayConfigurationIssue[] = [];
      if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId)) issues.push({ setting: 'RAZORPAY_TEST_KEY_ID', action: 'Configure a valid rzp_test_ key ID from the intended test account.' });
      if (!keySecret) issues.push({ setting: 'RAZORPAY_TEST_KEY_SECRET', action: 'Configure the secret paired with the test key ID.' });
      if (!webhookSecret) issues.push({ setting: 'RAZORPAY_TEST_WEBHOOK_SECRET', action: 'Configure the test webhook signing secret.' });
      throw new RazorpayConfigurationError('Razorpay test credentials are incomplete or invalid', issues);
    }
    return { mode: 'test', keyId, keySecret, webhookSecret };
  }

  if (appEnv === 'production') {
    const issues = [
      ...requiredValueIssue(env, 'NODE_ENV', 'production'),
      ...requiredValueIssue(env, 'RAZORPAY_MODE', 'live'),
      ...populatedIssues(env, testKeys),
    ];
    if (issues.length) throw new RazorpayConfigurationError('Razorpay production environment mismatch', issues);
    const keyId = value(env, 'RAZORPAY_PLATFORM_KEY_ID') || value(env, 'RAZORPAY_KEY_ID');
    const keySecret = value(env, 'RAZORPAY_PLATFORM_KEY_SECRET') || value(env, 'RAZORPAY_KEY_SECRET');
    const webhookSecret = value(env, 'RAZORPAY_PLATFORM_WEBHOOK_SECRET') || value(env, 'RAZORPAY_WEBHOOK_SECRET');
    if (!/^rzp_live_[A-Za-z0-9]+$/.test(keyId) || !keySecret) {
      const issues: RazorpayConfigurationIssue[] = [];
      if (!/^rzp_live_[A-Za-z0-9]+$/.test(keyId)) issues.push({ setting: 'RAZORPAY_PLATFORM_KEY_ID', action: 'Configure a valid rzp_live_ key ID from the intended live account.' });
      if (!keySecret) issues.push({ setting: 'RAZORPAY_PLATFORM_KEY_SECRET', action: 'Configure the secret paired with the live key ID.' });
      throw new RazorpayConfigurationError('Razorpay live credentials are incomplete or invalid', issues);
    }
    return { mode: 'live', keyId, keySecret, webhookSecret };
  }

  throw new RazorpayConfigurationError('Razorpay APP_ENV is unknown; payment operations are disabled', [{ setting: 'APP_ENV', action: 'Set APP_ENV=production for the live store, staging for the staging service, or development for local test payments.' }]);
};

export const inspectRazorpayConfiguration = (env: NodeJS.ProcessEnv = process.env) => {
  try {
    const credentials = resolveRazorpayCredentials(env);
    const issues: RazorpayConfigurationIssue[] = credentials.webhookSecret ? [] : [{
      setting: 'RAZORPAY_PLATFORM_WEBHOOK_SECRET', action: 'Configure the live webhook signing secret on the backend service.',
    }];
    return { checkoutReady: true, webhookReady: Boolean(credentials.webhookSecret), mode: credentials.mode, code: 'CONFIGURED', issues };
  } catch (error) {
    if (!(error instanceof RazorpayConfigurationError)) throw error;
    return { checkoutReady: false, webhookReady: false, mode: null, code: error.code, issues: error.issues };
  }
};
