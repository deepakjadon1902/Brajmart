import { resolveRazorpayCredentials } from './razorpayEnvironment';

export type CapturedPaymentExpectation = {
  orderId: string;
  paymentId: string;
  amount: number;
  liveOnly?: boolean;
};

export const isCapturedRazorpayPayment = (payment: any, expected: CapturedPaymentExpectation) => {
  const amountPaise = Math.round(expected.amount * 100);
  return /^order_[A-Za-z0-9]+$/.test(expected.orderId)
    && /^pay_[A-Za-z0-9]+$/.test(expected.paymentId)
    && payment?.id === expected.paymentId
    && payment?.order_id === expected.orderId
    && payment?.status === 'captured'
    && payment?.captured === true
    && payment?.currency === 'INR'
    && Number.isSafeInteger(amountPaise) && amountPaise > 0
    && payment?.amount === amountPaise
    && payment?.amount_refunded === 0;
};

export const verifyCapturedRazorpayPayment = async (expected: CapturedPaymentExpectation) => {
  return verifyCapturedRazorpayPaymentWithOptions(expected, {});
};

export const verifyCapturedRazorpayPaymentWithOptions = async (
  expected: CapturedPaymentExpectation,
  options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch } = {},
) => {
  const credentials = resolveRazorpayCredentials(options.env || process.env);
  if (expected.liveOnly && credentials.mode !== 'live') throw new Error('Production purchases require live-mode Razorpay verification');
  if (!/^order_[A-Za-z0-9]+$/.test(expected.orderId) || !/^pay_[A-Za-z0-9]+$/.test(expected.paymentId)) {
    throw new Error('Invalid Razorpay payment identifiers');
  }

  const fetcher = options.fetcher || fetch;
  const response = await fetcher(`https://api.razorpay.com/v1/payments/${encodeURIComponent(expected.paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Unable to verify Razorpay payment');
  const payment = await response.json();
  if (!isCapturedRazorpayPayment(payment, expected)) {
    throw new Error('Razorpay payment must be captured, unrefunded and match this order, amount and currency');
  }
  return payment;
};
