import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { sendOrderConfirmation, sendShippingUpdate } from '../lib/email';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString } from '../lib/dbHelpers';

const router = Router();

const mapOrderRow = (row: any) => ({
  _id: String(row.id),
  orderId: Number(row.id),
  userId: row.user_id ? String(row.user_id) : undefined,
  items: parseJson(row.items, []),
  total: Number(row.total),
  status: row.status,
  customerName: row.customer_name ?? undefined,
  customerEmail: row.customer_email ?? undefined,
  shippingAddress: parseJson(row.shipping_address, {}),
  billingAddress: parseJson(row.billing_address, {}),
  paymentMethod: row.payment_method,
  trackingId: row.tracking_id ?? undefined,
  estimatedDelivery: toIsoString(row.estimated_delivery),
  statusHistory: parseJson(row.status_history, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

router.get('/my', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (email) {
      const rows = await dbQuery<any>(
        'SELECT * FROM orders WHERE user_id = ? OR (user_id IS NULL AND LOWER(customer_email) = ?) ORDER BY created_at DESC',
        [req.user?.id, email]
      );
      return res.json(rows.map(mapOrderRow));
    }
    const rows = await dbQuery<any>('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user?.id]);
    res.json(rows.map(mapOrderRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows.map(mapOrderRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/track/:orderId', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const orderId = parseInt(req.params.orderId, 10);
    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!rows[0]) return res.status(404).json({ message: 'Order not found' });
    res.json(mapOrderRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);
    const estimatedDelivery = getEstimatedDeliveryDate(max);

    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const data = req.body || {};
    const status = data.status || 'confirmed';
    const statusHistory = Array.isArray(data.statusHistory) && data.statusHistory.length
      ? data.statusHistory
      : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];

    const result: any = await dbExecute(
      'INSERT INTO orders (user_id, items, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.userId || req.user?.id || null,
        JSON.stringify(data.items || []),
        data.total,
        status,
        data.customerName || null,
        data.customerEmail || null,
        JSON.stringify(data.shippingAddress || {}),
        JSON.stringify(data.billingAddress || {}),
        data.paymentMethod,
        null,
        estimatedDelivery,
        JSON.stringify(statusHistory),
      ]
    );

    const orderId = result.insertId;
    const trackingId = `BM${orderId}`;
    await dbExecute('UPDATE orders SET tracking_id = ? WHERE id = ?', [trackingId, orderId]);

    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    const order = mapOrderRow(rows[0]);

    if (order.customerEmail) {
      sendOrderConfirmation(order.customerEmail, {
        orderId: String(order.orderId),
        total: order.total,
        itemsCount: order.items?.length || 0,
        eta: etaText,
        items: order.items,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
      }).catch(() => {});
    }
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Order not found' });

    const history = parseJson<Array<{ status: string; date: string; note?: string }>>(row.status_history, []);
    history.push({ status, date: new Date().toISOString(), note });

    await dbExecute('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [status, JSON.stringify(history), req.params.id]);

    const updatedRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
    const order = mapOrderRow(updatedRows[0]);

    if (order.customerEmail) {
      const { min, max } = await getEtaConfig();
      const etaText = getEtaText(min, max);
      sendShippingUpdate(order.customerEmail, {
        orderId: String(order.orderId),
        status,
        trackingId: order.trackingId,
        eta: etaText,
        details: {
          items: order.items,
          total: order.total,
          paymentMethod: order.paymentMethod,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
        },
      }).catch(() => {});
    }
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
