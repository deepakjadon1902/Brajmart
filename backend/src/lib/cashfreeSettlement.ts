import type { RowDataPacket } from 'mysql2/promise';
import { CashfreeApiError, cashfreeAmountMatches, checkCashfreePayment, resolveCashfreeConfig } from './cashfree';
import { cancelCartRemindersForOrder } from './cartFollowups';
import { dbQuery, isDbConnected, withDbTransaction } from './db';
import { parseJson } from './dbHelpers';
import { convertReservationToSale, releaseInventoryForOrder } from './inventory';
import { markCouponUsed } from './orderPricing';
import { sendPaymentOutcomeNotices } from './paymentNotices';

const settleCashfree = async (token: string, status: 'paid' | 'failed', paymentId?: string) => {
  const changed = await withDbTransaction(async (connection) => {
    const [attempts] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM payment_status WHERE token = ? FOR UPDATE', [token]
    );
    const attempt = attempts[0];
    if (attempt?.method !== 'Cashfree' || attempt.status !== 'pending') return null;
    const [orders] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE', [attempt.order_id]
    );
    const order = orders[0];
    if (order?.payment_method !== 'Cashfree' || order.status !== 'pending_payment'
      || !cashfreeAmountMatches(attempt.amount, Number(order.total))) throw new Error('Cashfree checkout does not match its stored order');

    const items = parseJson(order.items, []);
    const orderStatus = status === 'paid' ? 'confirmed' : 'cancelled';
    const history = parseJson<Array<{ status: string; date: string; note?: string }>>(order.status_history, []);
    history.push({
      status: orderStatus,
      date: new Date().toISOString(),
      note: status === 'paid' ? 'Payment verified through Cashfree' : 'Cashfree checkout expired without payment',
    });
    if (status === 'paid') {
      await convertReservationToSale(connection, Number(order.id), items);
      if (order.coupon_code) await markCouponUsed(order.coupon_code, connection);
    } else {
      await releaseInventoryForOrder(connection, Number(order.id), items);
    }
    await connection.execute('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
      [orderStatus, JSON.stringify(history), order.id]);
    await connection.execute('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE order_id = ? AND transaction_id = ?',
      [status, paymentId || token, order.id, token]);
    await connection.execute('UPDATE payment_status SET status = ?, payment_id = ?, updated_at = NOW() WHERE token = ?',
      [status, paymentId || null, token]);
    await connection.execute('UPDATE checkout_sessions SET status = ?, updated_at = NOW() WHERE payment_token = ?',
      [status, token]);
    return { order, amount: Number(attempt.amount) };
  });

  if (!changed) return;
  if (status === 'paid') void cancelCartRemindersForOrder(changed.order.customer_email).catch(() => {});
  void sendPaymentOutcomeNotices(changed.order, status, paymentId || token, 'Cashfree', changed.amount).catch((error) => {
    console.error('Cashfree payment notice could not be prepared:', error instanceof Error ? error.message : error);
  });
};

export const reconcileCashfreeToken = async (token: string) => {
  const rows = await dbQuery(
    `SELECT ps.*, UNIX_TIMESTAMP(cs.expires_at) AS expires_epoch
       FROM payment_status ps LEFT JOIN checkout_sessions cs ON cs.payment_token = ps.token
      WHERE ps.token = ? AND ps.method = 'Cashfree' LIMIT 1`, [token]
  );
  const current = rows[0];
  if (!current || current.status !== 'pending') return { row: current };
  const result = await checkCashfreePayment(token, Number(current.amount)).catch((error: unknown) => {
    const expiresAt = Number(current.expires_epoch) * 1000;
    // Create Order can fail before Cashfree has an order. After the original
    // expiry, this merchant order ID can no longer be opened for payment.
    if (error instanceof CashfreeApiError && error.status === 404 && error.path === '/orders/' + token
      && expiresAt > 0 && expiresAt + 60_000 < Date.now()) {
      return { status: 'failed' as const };
    }
    throw error;
  });
  if (result.status === 'pending') return { row: current, session: result.session };
  await settleCashfree(token, result.status, result.status === 'paid' ? result.paymentId : undefined);
  const [refreshed] = await dbQuery('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
  return { row: refreshed };
};

export const startCashfreeExpiryReconciliation = () => {
  try { resolveCashfreeConfig(); } catch { return; }
  let running = false;
  let lastSessionId = 0;
  const timer = setInterval(async () => {
    if (running || !isDbConnected()) return;
    running = true;
    try {
      const expired = await dbQuery(
        `SELECT cs.id, cs.payment_token FROM checkout_sessions cs
           JOIN payment_status ps ON ps.token = cs.payment_token AND ps.method = 'Cashfree'
          WHERE cs.id > ? AND cs.status = 'active' AND cs.expires_at < NOW() AND ps.status = 'pending'
          ORDER BY cs.id LIMIT 25`, [lastSessionId]
      );
      for (const row of expired) {
        lastSessionId = Number(row.id);
        await reconcileCashfreeToken(String(row.payment_token)).catch(() => {});
      }
      if (expired.length < 25) lastSessionId = 0;
    } catch (error) {
      console.error('Cashfree expiry reconciliation failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
};
