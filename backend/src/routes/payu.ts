import { Router } from 'express';
import crypto from 'crypto';
import Order from '../models/Order';
import Payment from '../models/Payment';
import PaymentStatus from '../models/PaymentStatus';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { sendOrderConfirmation, sendPaymentFailed, sendPaymentReceipt, sendAdminPaymentNotice } from '../lib/email';

const router = Router();

const getBackendUrl = () => process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';

const getPayuConfig = () => {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  const env = (process.env.PAYU_ENV || 'test').toLowerCase();
  const actionUrl = env === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  return { key, salt, env, actionUrl };
};

const sha512 = (value: string) => crypto.createHash('sha512').update(value).digest('hex');

const buildRequestHash = (params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}) => {
  const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
  const hashString = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    ...udf,
    '', '', '', '', '',
    params.salt,
  ].join('|');
  return sha512(hashString);
};

const buildResponseHash = (params: {
  key: string;
  salt: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}) => {
  const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
  const hashString = [
    params.salt,
    params.status,
    '', '', '', '', '', '',
    udf[4], udf[3], udf[2], udf[1], udf[0],
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join('|');
  return sha512(hashString);
};

router.post('/create-order', auth, async (req: AuthRequest, res) => {
  try {
    const { key, salt, actionUrl } = getPayuConfig();
    if (!key || !salt) return res.status(500).json({ message: 'PayU credentials are not configured' });

    const { amount, method, order, customer } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    if (!order || !customer?.email || !customer?.name) return res.status(400).json({ message: 'Missing order details' });

    const txnid = `PAYU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const productinfo = `BrajMart Order (${Array.isArray(order.items) ? order.items.length : 0} items)`;
    const formattedAmount = Number(amount).toFixed(2);

    memory.createPayuDraft({
      txnid,
      createdAt: new Date().toISOString(),
      amount: Number(amount),
      method: method === 'card' ? 'card' : 'upi',
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      order,
    });
    memory.upsertPaymentStatus(txnid, {
      status: 'pending',
      amount: Number(amount),
      method: method === 'card' ? 'PayU Card' : 'PayU UPI',
    });

    if (isDbConnected()) {
      await PaymentStatus.findOneAndUpdate(
        { token: txnid },
        {
          token: txnid,
          status: 'pending',
          amount: Number(amount),
          method: method === 'card' ? 'PayU Card' : 'PayU UPI',
        },
        { upsert: true, new: true }
      );
    }

    const surl = `${getBackendUrl()}/api/payu/success`;
    const furl = `${getBackendUrl()}/api/payu/failure`;

    const fields: Record<string, string> = {
      key,
      txnid,
      amount: formattedAmount,
      productinfo,
      firstname: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      surl,
      furl,
    };

    if (method === 'upi') fields.pg = 'UPI';
    if (method === 'card') fields.pg = 'CC';

    fields.hash = buildRequestHash({
      key,
      txnid,
      amount: formattedAmount,
      productinfo,
      firstname: customer.name,
      email: customer.email,
      salt,
    });

    res.json({ actionUrl, fields });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to create PayU order' });
  }
});

const handlePayuCallback = async (req: any, res: any, statusOverride?: 'success' | 'failure') => {
  const { key, salt } = getPayuConfig();
  if (!key || !salt) return res.status(500).send('PayU not configured');

  const status = statusOverride || req.body.status;
  const txnid = req.body.txnid;
  const amount = req.body.amount;
  const productinfo = req.body.productinfo;
  const firstname = req.body.firstname;
  const email = req.body.email;
  const receivedHash = req.body.hash;
  const udf1 = req.body.udf1;
  const udf2 = req.body.udf2;
  const udf3 = req.body.udf3;
  const udf4 = req.body.udf4;
  const udf5 = req.body.udf5;
  const paymentId = req.body.mihpayid || req.body.payuMoneyId || txnid;

  const computed = buildResponseHash({
    key,
    salt,
    status,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
  });

  const frontendUrl = getFrontendUrl();

  if (computed !== receivedHash) {
    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
  }

  const draft = memory.removePayuDraft(txnid);
  if (!draft) {
    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
  }

  const { min, max } = await getEtaConfig();
  const etaText = getEtaText(min, max);
  const estimatedDelivery = getEstimatedDeliveryDate(max);
  const methodLabel = draft.method === 'card' ? 'PayU Card' : 'PayU UPI';

  if (status === 'success') {
    if (!isDbConnected()) {
      const createdOrder = memory.createOrder({ ...draft.order, estimatedDelivery: estimatedDelivery.toISOString() });
      const createdPayment = memory.createPayment({
        orderId: createdOrder.orderId,
        customerName: draft.customer.name,
        customerEmail: draft.customer.email,
        method: methodLabel,
        amount: Number(amount),
        status: 'paid',
        transactionId: String(paymentId),
      });
      if (createdOrder.customerEmail) {
        sendOrderConfirmation(createdOrder.customerEmail, { orderId: String(createdOrder.orderId), total: createdOrder.total, itemsCount: createdOrder.items?.length || 0, eta: etaText }).catch(() => {});
      }
      if (createdPayment.customerEmail) {
        sendPaymentReceipt(createdPayment.customerEmail, { orderId: String(createdOrder.orderId), amount: createdPayment.amount, paymentId: createdPayment.transactionId, eta: etaText }).catch(() => {});
      }
      sendAdminPaymentNotice({
        status: 'paid',
        orderId: String(createdOrder.orderId),
        amount: createdPayment.amount,
        paymentId: createdPayment.transactionId,
        method: createdPayment.method,
        customerEmail: createdPayment.customerEmail,
      }).catch(() => {});
      memory.upsertPaymentStatus(txnid, {
        status: 'paid',
        orderId: createdOrder.orderId,
        amount: createdPayment.amount,
        method: createdPayment.method,
        paymentId: createdPayment.transactionId,
      });
      return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
    }

    const order = new Order({ ...draft.order, estimatedDelivery });
    await order.save();
    if (order.customerEmail) {
      sendOrderConfirmation(order.customerEmail, { orderId: String(order.orderId), total: order.total, itemsCount: order.items?.length || 0, eta: etaText }).catch(() => {});
    }
    const payment = await Payment.create({
      orderId: order.orderId,
      customerName: draft.customer.name,
      customerEmail: draft.customer.email,
      method: methodLabel,
      amount: Number(amount),
      status: 'paid',
      transactionId: String(paymentId),
    });
    if (payment.customerEmail) {
      sendPaymentReceipt(payment.customerEmail, { orderId: String(order.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
    }
    sendAdminPaymentNotice({
      status: 'paid',
      orderId: String(order.orderId),
      amount: payment.amount,
      paymentId: payment.transactionId,
      method: payment.method,
      customerEmail: payment.customerEmail,
    }).catch(() => {});
    await PaymentStatus.findOneAndUpdate(
      { token: txnid },
      {
        token: txnid,
        status: 'paid',
        orderId: order.orderId,
        amount: payment.amount,
        method: payment.method,
        paymentId: payment.transactionId,
      },
      { upsert: true, new: true }
    );
    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
  }

  const failedPayment = {
    orderId: 0,
    customerName: draft.customer.name,
    customerEmail: draft.customer.email,
    method: methodLabel,
    amount: Number(amount),
    status: 'failed' as const,
    transactionId: String(paymentId),
  };

  if (!isDbConnected()) {
    memory.createPayment(failedPayment);
    memory.upsertPaymentStatus(txnid, {
      status: 'failed',
      amount: Number(amount),
      method: methodLabel,
      paymentId: String(paymentId),
    });
  } else {
    await Payment.create(failedPayment);
    await PaymentStatus.findOneAndUpdate(
      { token: txnid },
      {
        token: txnid,
        status: 'failed',
        amount: Number(amount),
        method: methodLabel,
        paymentId: String(paymentId),
      },
      { upsert: true, new: true }
    );
  }

  if (draft.customer.email) {
    sendPaymentFailed(draft.customer.email, { orderId: 'N/A', amount: Number(amount), paymentId: String(paymentId), eta: etaText }).catch(() => {});
  }
  sendAdminPaymentNotice({
    status: 'failed',
    orderId: 'N/A',
    amount: Number(amount),
    paymentId: String(paymentId),
    method: methodLabel,
    customerEmail: draft.customer.email,
  }).catch(() => {});

  return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
};

router.post('/success', async (req, res) => {
  handlePayuCallback(req, res, 'success').catch((err) => {
    console.error(err);
    res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
  });
});

router.post('/failure', async (req, res) => {
  handlePayuCallback(req, res, 'failure').catch((err) => {
    console.error(err);
    res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
  });
});

export default router;
