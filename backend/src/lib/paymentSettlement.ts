import { dbQuery, dbExecute, withDbTransaction } from './db';
import { parseJson } from './dbHelpers';
import { convertReservationToSale, releaseInventoryForOrder } from './inventory';
import { markCouponUsed } from './orderPricing';
import { cancelCartRemindersForOrder } from './cartFollowups';
import { capturePurchaseOrderContext, sendVerifiedPurchaseForOrder } from './purchaseTracking';
import { verifyCapturedRazorpayPayment } from './razorpayVerification';
import { sendPaymentOutcomeNotices } from './paymentNotices';

const markCheckoutSessionStatus = async (paymentToken: string, status: 'paid' | 'failed') => {
  await dbExecute(
    'UPDATE checkout_sessions SET status = ?, updated_at = NOW() WHERE payment_token = ?',
    [status, paymentToken]
  );
};

const hasPaidSettlement = async (orderId: any) => {
  if (!orderId) return false;
  const rows = await dbQuery<any>(
    `SELECT 1
     FROM payments p
     WHERE p.order_id = ? AND p.status = 'paid'
     UNION ALL
     SELECT 1
     FROM payment_status ps
     WHERE ps.order_id = ? AND ps.status = 'paid'
     LIMIT 1`,
    [orderId, orderId]
  );
  return rows.length > 0;
};

export const updateOrderForPayment = async (params: {
  token: string;
  paymentId?: string;
  status: 'paid' | 'failed';
  note: string;
  provider?: 'Razorpay' | 'PayU';
  metaContext?: unknown;
  request?: any;
}) => {
  const provider = params.provider || 'Razorpay';
  const statusRows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [params.token]);
  const statusRow = statusRows[0];
  if (!statusRow) return null;
  if (params.status === 'paid') {
    const orderRows = await dbQuery<any>('SELECT total, payment_method FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    if (String(statusRow.method || '').toLowerCase() !== provider.toLowerCase()
      || String(orderRows[0]?.payment_method || '').toLowerCase() !== provider.toLowerCase()) {
      throw new Error(`Payment must belong to a ${provider} checkout`);
    }
    const total = Number(orderRows[0]?.total);
    if (!Number.isFinite(total) || Math.round(total * 100) !== Math.round(Number(statusRow.amount) * 100)) {
      throw new Error(`${provider} payment amount does not match the stored order total`);
    }
    if (provider === 'Razorpay') {
      await verifyCapturedRazorpayPayment({ orderId: params.token, paymentId: params.paymentId || '', amount: total });
    }
  }
  if (String(statusRow.status || '') === 'paid' && params.status === 'failed') {
    return { orderId: statusRow.order_id, paymentId: statusRow.payment_id || params.paymentId || params.token, status: 'paid' };
  }

  if (params.status === 'failed' && await hasPaidSettlement(statusRow.order_id)) {
    await dbExecute(
      'UPDATE payment_status SET status = ?, updated_at = NOW() WHERE token = ?',
      ['paid', params.token]
    );
    return { orderId: statusRow.order_id, paymentId: statusRow.payment_id || params.paymentId || params.token, status: 'paid' };
  }

  const alreadyFinal = String(statusRow.status || '') === params.status;
  if (alreadyFinal) {
    if (params.paymentId && String(statusRow.payment_id || '') !== params.paymentId) {
      await dbExecute(
        'UPDATE payment_status SET payment_id = ?, updated_at = NOW() WHERE token = ?',
        [params.paymentId, params.token]
      );
      await dbExecute(
        'UPDATE payments SET transaction_id = ?, updated_at = NOW() WHERE order_id = ? ORDER BY id DESC LIMIT 1',
        [params.paymentId, statusRow.order_id]
      );
    }
    if (params.status === 'paid') {
      const paidOrderRows = await dbQuery<any>('SELECT customer_email FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
      await cancelCartRemindersForOrder(paidOrderRows[0]?.customer_email).catch(() => {});
      if (params.metaContext || params.request) await capturePurchaseOrderContext(statusRow.order_id, params.metaContext, params.request);
      // A duplicate signed callback is also a safe retry after a provider outage.
      // Each provider reserves the stable order ID before sending again.
      void sendVerifiedPurchaseForOrder(statusRow.order_id, params.paymentId || statusRow.payment_id, params.token);
    }
    return { orderId: statusRow.order_id, paymentId: params.paymentId || statusRow.payment_id || params.token, status: params.status };
  }

  const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
  let orderRow = orderRows[0];
  if (!orderRow) return null;

  const orderStatus = params.status === 'paid' ? 'confirmed' : 'cancelled';
  const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
  const alreadyHasTerminalNote = history.some((entry) => String(entry.note || '') === params.note);
  if (!alreadyHasTerminalNote) {
    history.push({ status: orderStatus, date: new Date().toISOString(), note: params.note });
  }

  await dbExecute(
    'UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
    [orderStatus, JSON.stringify(history), statusRow.order_id]
  );

  const paymentRows = await dbQuery<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [statusRow.order_id]);
  const paymentRow = paymentRows[0];
  const transactionId = params.paymentId || paymentRow?.transaction_id || params.token;

  if (paymentRow) {
    await dbExecute(
      'UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?',
      [params.status, transactionId, paymentRow.id]
    );
  } else {
    await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [statusRow.order_id, orderRow.customer_name || '', orderRow.customer_email || '', statusRow.method || provider, Number(statusRow.amount || orderRow.total || 0), params.status, transactionId]
    );
  }

  await dbExecute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
    [params.token, params.status, statusRow.order_id, Number(statusRow.amount || orderRow.total || 0), statusRow.method || provider, transactionId]
  );

  if (params.status === 'paid') await cancelCartRemindersForOrder(orderRow.customer_email).catch(() => {});

  const orderItems = parseJson(orderRow.items, []);
  if (params.status === 'paid') {
    await withDbTransaction((connection) => convertReservationToSale(connection, Number(statusRow.order_id), orderItems));
    await markCheckoutSessionStatus(params.token, 'paid').catch(() => {});
  } else {
    await withDbTransaction((connection) => releaseInventoryForOrder(connection, Number(statusRow.order_id), orderItems));
    await markCheckoutSessionStatus(params.token, 'failed').catch(() => {});
  }

  if (params.status === 'paid' && orderRow.coupon_code) {
    await markCouponUsed(orderRow.coupon_code);
  }

  const refreshedRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
  orderRow = refreshedRows[0] || orderRow;
  await sendPaymentOutcomeNotices(orderRow, params.status, transactionId, statusRow.method || provider, Number(statusRow.amount || orderRow.total || 0));

  if (params.status === 'paid') {
    if (params.metaContext || params.request) {
      await capturePurchaseOrderContext(statusRow.order_id, params.metaContext, params.request).catch(() => {});
    }
    sendVerifiedPurchaseForOrder(statusRow.order_id, transactionId, params.token).catch((err) => {
      console.error('Meta verified Purchase event failed:', err);
    });
  }

  return { orderId: statusRow.order_id, paymentId: transactionId, status: params.status };
};

