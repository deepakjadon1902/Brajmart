import crypto from 'node:crypto';

export class CashfreeConfigurationError extends Error {}

export class CashfreeApiError extends Error {
  constructor(readonly status: number, readonly path: string) {
    super(`Cashfree API request failed (${status})`);
  }
}

export const resolveCashfreeConfig = (env = process.env) => {
  const live = (env.APP_ENV || env.NODE_ENV)?.trim().toLowerCase() === 'production';
  const mode = env.CASHFREE_ENV?.trim().toLowerCase() || (live ? 'production' : 'sandbox');
  const appId = env.CASHFREE_APP_ID?.trim();
  const secret = env.CASHFREE_SECRET_KEY?.trim();
  if (!appId || !secret || (live ? mode !== 'production' : mode !== 'sandbox')) {
    throw new CashfreeConfigurationError('Check CASHFREE_APP_ID, CASHFREE_SECRET_KEY and CASHFREE_ENV for this environment.');
  }

  try {
    const frontend = new URL(env.FRONTEND_URL || env.SITE_URL || (live ? 'https://www.brajmart.com' : 'http://localhost:5173'));
    const backend = env.BACKEND_URL || env.PUBLIC_BASE_URL;
    const notify = backend ? new URL('/api/cashfree/webhook', backend) : null;
    if (!['https:', 'http:'].includes(frontend.protocol) || frontend.username || frontend.password
      || notify?.username || notify?.password
      || (live && (frontend.protocol !== 'https:' || notify?.protocol !== 'https:'))) throw new Error();
    return {
      mode,
      appId,
      secret,
      apiUrl: live ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
      frontendUrl: frontend.origin,
      notifyUrl: notify?.protocol === 'https:' ? notify.href : undefined,
    };
  } catch {
    throw new CashfreeConfigurationError('Configure FRONTEND_URL and the public HTTPS BACKEND_URL for Cashfree.');
  }
};

type CashfreeConfig = ReturnType<typeof resolveCashfreeConfig>;

const request = async <T>(config: CashfreeConfig, path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(config.apiUrl + path, {
    ...init,
    headers: {
      'x-api-version': '2025-01-01',
      'x-client-id': config.appId,
      'x-client-secret': config.secret,
      Accept: 'application/json',
      ...init.headers,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new CashfreeApiError(response.status, path);
  return response.json() as Promise<T>;
};

type CashfreeOrder = {
  order_id: string;
  order_status: string;
  order_currency: string;
  order_amount: number;
  payment_session_id: string;
};

type CashfreePayment = {
  cf_payment_id: string | number;
  order_id: string;
  payment_status: string;
  payment_currency: string;
  payment_amount: number;
  is_captured: boolean;
};

export const isCashfreeToken = (token: string) => /^cf_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(token);
export const cashfreeAmountMatches = (received: unknown, expected: number) =>
  (typeof received === 'number' || (typeof received === 'string' && /^\d+(\.\d{1,2})?$/.test(received)))
  && Number.isFinite(expected) && expected >= 1 && Math.round(Number(received) * 100) === Math.round(expected * 100);

const validateOrder = (order: CashfreeOrder, token: string, amount: number) => {
  if (order.order_id !== token || order.order_currency !== 'INR' || !cashfreeAmountMatches(order.order_amount, amount)) {
    throw new Error('Cashfree order details do not match the stored order');
  }
  return order;
};

export const createCashfreeSession = async (config: CashfreeConfig, checkout: {
  token: string;
  amount: number;
  expiresAt: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  alreadyPaid: boolean;
  created: boolean;
}) => {
  if (checkout.alreadyPaid || checkout.expiresAt <= Date.now()) return { showStatus: true };
  if (!checkout.created) {
    try {
      const current = await checkCashfreePayment(checkout.token, checkout.amount);
      return current.status === 'pending' && current.session ? current.session : { showStatus: true };
    } catch (error) {
      if (!(error instanceof CashfreeApiError && error.status === 404 && error.path === '/orders/' + checkout.token)) throw error;
      // The first submission may have stopped before the gateway received it.
    }
  }
  const order = validateOrder(await request<CashfreeOrder>(config, '/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-idempotency-key': checkout.token.slice(3) },
    body: JSON.stringify({
      order_id: checkout.token,
      order_amount: checkout.amount,
      order_currency: 'INR',
      order_expiry_time: new Date(checkout.expiresAt).toISOString(),
      customer_details: {
        customer_id: checkout.token,
        customer_name: checkout.customerName.slice(0, 100),
        customer_email: checkout.customerEmail,
        customer_phone: checkout.customerPhone,
      },
      order_meta: {
        return_url: `${config.frontendUrl}/payment-status/${checkout.token}`,
        notify_url: config.notifyUrl,
      },
    }),
  }), checkout.token, checkout.amount);

  if (order.order_status !== 'ACTIVE') return { showStatus: true };
  if (!order.payment_session_id) throw new Error('Cashfree returned no payment session');
  return { mode: config.mode, paymentSessionId: order.payment_session_id };
};

export const checkCashfreePayment = async (token: string, amount: number) => {
  const config = resolveCashfreeConfig();
  const path = '/orders/' + encodeURIComponent(token);
  const order = validateOrder(await request<CashfreeOrder>(config, path), token, amount);
  const payments = await request<CashfreePayment[]>(config, path + '/payments');
  const settled = payments.find((payment) => payment.payment_status === 'SUCCESS'
    && payment.order_id === token && payment.is_captured === true && payment.payment_currency === 'INR'
    && cashfreeAmountMatches(payment.payment_amount, amount) && /^\d+$/.test(String(payment.cf_payment_id)));
  if (order.order_status === 'PAID' && settled) return { status: 'paid' as const, paymentId: String(settled.cf_payment_id) };

  const hasNoUnsettledAttempts = payments.every((payment) =>
    ['NOT_ATTEMPTED', 'FAILED', 'USER_DROPPED', 'CANCELLED', 'VOID'].includes(payment.payment_status));
  if (['EXPIRED', 'TERMINATED'].includes(order.order_status) && hasNoUnsettledAttempts) return { status: 'failed' as const };
  return {
    status: 'pending' as const,
    session: order.order_status === 'ACTIVE' && hasNoUnsettledAttempts && order.payment_session_id
      ? { mode: config.mode, paymentSessionId: order.payment_session_id }
      : undefined,
  };
};

export const verifyCashfreeSignature = (body: string, timestamp: string, signature: string, secret: string) => {
  if (!body || !/^\d{10,16}$/.test(timestamp) || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp).update(body).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'base64'));
};
