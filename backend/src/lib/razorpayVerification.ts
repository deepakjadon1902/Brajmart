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
  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured');
  if ((expected.liveOnly || process.env.NODE_ENV === 'production') && !/^rzp_live_/.test(keyId)) {
    throw new Error('Production purchases require live-mode Razorpay verification');
  }
  if (!/^order_[A-Za-z0-9]+$/.test(expected.orderId) || !/^pay_[A-Za-z0-9]+$/.test(expected.paymentId)) {
    throw new Error('Invalid Razorpay payment identifiers');
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(expected.paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Unable to verify Razorpay payment');
  const payment = await response.json();
  if (!isCapturedRazorpayPayment(payment, expected)) {
    throw new Error('Razorpay payment must be captured, unrefunded and match this order, amount and currency');
  }
  return payment;
};
