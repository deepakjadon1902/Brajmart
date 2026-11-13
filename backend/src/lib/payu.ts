import crypto from 'crypto';

export type PayUEnvironment = 'test' | 'live';

export type PayUConfig = {
  key: string;
  salt: string;
  environment: PayUEnvironment;
  paymentUrl: string;
  verifyUrl: string;
  callbackUrl: string;
  frontendUrl: string;
};

export class PayUConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayUConfigurationError';
  }
}

const clean = (value: unknown) => String(value ?? '').trim();

export const resolvePayUConfig = (env: NodeJS.ProcessEnv = process.env): PayUConfig => {
  const key = clean(env.PAYU_KEY);
  const salt = clean(env.PAYU_SALT);
  const requestedEnvironment = clean(env.PAYU_ENV).toLowerCase();
  const defaultEnvironment: PayUEnvironment = clean(env.APP_ENV).toLowerCase() === 'production'
    && clean(env.NODE_ENV).toLowerCase() === 'production'
    ? 'live'
    : 'test';
  const environment = requestedEnvironment
    ? (['live', 'production'].includes(requestedEnvironment) ? 'live' : ['test', 'sandbox', 'staging'].includes(requestedEnvironment) ? 'test' : null)
    : defaultEnvironment;

  if (!key || !salt) throw new PayUConfigurationError('PayU is not configured. Add PAYU_KEY and PAYU_SALT to the backend environment.');
  if (!environment) throw new PayUConfigurationError('PAYU_ENV must be set to test or live.');

  const callbackSource = clean(env.PAYU_CALLBACK_URL || env.BACKEND_URL || env.PUBLIC_BASE_URL
    || (environment === 'test' && clean(env.APP_ENV).toLowerCase() !== 'staging' ? 'http://localhost:5000' : ''));
  if (!callbackSource) throw new PayUConfigurationError('Set PAYU_CALLBACK_URL or BACKEND_URL to the public backend URL that receives PayU callbacks.');
  let callbackUrl: string;
  try {
    const parsed = new URL(callbackSource);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
    if (environment === 'live' && parsed.protocol !== 'https:') throw new PayUConfigurationError('Live PayU callbacks require an HTTPS PAYU_CALLBACK_URL or BACKEND_URL.');
    if (parsed.pathname === '/') callbackUrl = `${parsed.origin}/api/payu/callback`;
    else if (parsed.pathname.replace(/\/$/, '') === '/api/payu/callback') callbackUrl = `${parsed.origin}/api/payu/callback`;
    else throw new Error();
  } catch (error) {
    if (error instanceof PayUConfigurationError) throw error;
    throw new PayUConfigurationError('PAYU_CALLBACK_URL or BACKEND_URL must be a valid public URL.');
  }

  const frontendBase = clean(env.FRONTEND_URL || env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');
  let frontendUrl = frontendBase;
  try {
    const parsed = new URL(frontendBase);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    frontendUrl = parsed.origin;
  } catch {
    throw new PayUConfigurationError('FRONTEND_URL or SITE_URL must be a valid URL for PayU payment returns.');
  }

  return {
    key,
    salt,
    environment,
    paymentUrl: environment === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
    verifyUrl: environment === 'live'
      ? 'https://info.payu.in/merchant/postservice.php?form=2'
      : 'https://test.payu.in/merchant/postservice?form=2',
    callbackUrl,
    frontendUrl,
  };
};

const sha512 = (value: string) => crypto.createHash('sha512').update(value, 'utf8').digest('hex');
const asString = (value: unknown) => String(value ?? '');

export const createPayURequestHash = (fields: Record<string, string>, salt: string) => {
  const values = [
    fields.key,
    fields.txnid,
    fields.amount,
    fields.productinfo,
    fields.firstname,
    fields.email,
    fields.udf1 || '',
    fields.udf2 || '',
    fields.udf3 || '',
    fields.udf4 || '',
    fields.udf5 || '',
    '', '', '', '', '',
    salt,
  ];
  return sha512(values.join('|'));
};

const safeHashEqual = (expected: string, actual: string) => {
  if (!/^[a-f0-9]{128}$/i.test(actual) || !/^[a-f0-9]{128}$/i.test(expected)) return false;
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const verifyPayUResponseHash = (response: Record<string, unknown>, salt: string) => {
  const fields = Object.fromEntries(Object.entries(response).map(([key, value]) => [key, asString(value)]));
  const reverseValues = [
    salt,
    fields.status || '',
    ...(fields.splitInfo ? [fields.splitInfo] : []),
    '', '', '', '', '',
    fields.udf5 || '',
    fields.udf4 || '',
    fields.udf3 || '',
    fields.udf2 || '',
    fields.udf1 || '',
    fields.email || '',
    fields.firstname || '',
    fields.productinfo || '',
    fields.amount || '',
    fields.txnid || '',
    fields.key || '',
  ];
  if (fields.additional_charges) reverseValues.unshift(fields.additional_charges);
  return safeHashEqual(sha512(reverseValues.join('|')), fields.hash || '');
};

export const verifyPayUTransaction = async (txnid: string, expectedAmount: number) => {
  const config = resolvePayUConfig();
  const command = 'verify_payment';
  const hash = sha512(`${config.key}|${command}|${txnid}|${config.salt}`);
  const body = new URLSearchParams({ key: config.key, command, var1: txnid, hash });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(config.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('PayU payment verification is temporarily unavailable');
    const data = await response.json().catch(() => null) as any;
    const transactions = data?.transaction_details;
    const details = transactions && typeof transactions === 'object'
      ? transactions[txnid] || Object.values(transactions).find((item: any) => String(item?.txnid || '') === txnid)
      : null;
    const amount = Number(details?.amt ?? details?.amount ?? details?.transaction_amount);
    const isCaptured = String(details?.status || '').toLowerCase() === 'success'
      && String(details?.unmappedstatus || '').toLowerCase() === 'captured'
      && String(details?.txnid || txnid) === txnid
      && Number.isFinite(amount)
      && Math.round(amount * 100) === Math.round(expectedAmount * 100);

    return {
      captured: isCaptured,
      paymentId: String(details?.mihpayid || details?.mihpayupid || ''),
    };
  } finally {
    clearTimeout(timeout);
  }
};
