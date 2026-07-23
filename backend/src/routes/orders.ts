import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { sendOrderConfirmation, sendShippingUpdate } from '../lib/email';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { auth, adminOnly, optionalAuth, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString } from '../lib/dbHelpers';
import { computeTotals, getCheckoutSettings, hasPrasadamItems, priceAndValidateOrderItems } from '../lib/orderPricing';
import { upsertUserDefaultAddress } from '../lib/userAddress';
import { checkDtdcPincode, trackDtdcShipment } from '../lib/dtdc';

const router = Router();
const COD_CHARGE = 40;

const mapOrderRow = (row: any) => ({
  _id: String(row.id),
  orderId: Number(row.id),
  userId: row.user_id ? String(row.user_id) : undefined,
  items: parseJson(row.items, []),
  total: Number(row.total),
  itemsSubtotal: row.items_subtotal == null ? undefined : Number(row.items_subtotal),
  shippingAmount: row.shipping_amount == null ? undefined : Number(row.shipping_amount),
  packagingAmount: row.packaging_amount == null ? undefined : Number(row.packaging_amount),
  packagingRate: row.packaging_rate == null ? undefined : Number(row.packaging_rate),
  codAmount: row.cod_amount == null ? undefined : Number(row.cod_amount),
  codAvailable: row.cod_available == null ? undefined : Boolean(Number(row.cod_available)),
  codPincode: row.cod_pincode ?? undefined,
  codMessage: row.cod_message ?? undefined,
  status: row.status,
  customerName: row.customer_name ?? undefined,
  customerEmail: row.customer_email ?? undefined,
  shippingAddress: parseJson(row.shipping_address, {}),
  billingAddress: parseJson(row.billing_address, {}),
  paymentMethod: row.payment_method,
  trackingId: row.tracking_id ?? undefined,
  shippingService: row.shipping_service ?? undefined,
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

const findOrderByLookup = async (lookup: string) => {
  const input = String(lookup || '').trim();
  if (!input) return null;
  const rows = await dbQuery<any>(
    `SELECT * FROM orders
     WHERE LOWER(tracking_id) = LOWER(?) OR id = ?
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [input, /^\d+$/.test(input) ? Number(input) : -1]
  );
  return rows[0] || null;
};

const buildDtdcOrderStatusTracking = (order: ReturnType<typeof mapOrderRow>, message: string) => ({
  carrier: 'DTDC',
  trackingId: order.trackingId,
  currentStatus: order.status.replace(/_/g, ' '),
  lastLocation: '',
  events: [{
    status: order.status.replace(/_/g, ' '),
    location: '',
    date: order.updatedAt || order.createdAt || '',
    time: '',
    remarks: message,
  }],
});

router.get('/dtdc/track/:lookup', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const row = await findOrderByLookup(req.params.lookup);
    if (!row) {
      const trackingId = String(req.params.lookup || '').trim();
      if (!trackingId) return res.status(404).json({ message: 'Order not found' });
      const tracking = await trackDtdcShipment({ trackingId });
      return res.json({ order: null, tracking });
    }

    const order = mapOrderRow(row);
    const service = String(order.shippingService || '').toLowerCase();
    if (service && !service.includes('dtdc')) {
      return res.status(400).json({ message: 'This order is not assigned to DTDC' });
    }
    if (!order.trackingId) return res.status(400).json({ message: 'DTDC tracking ID is not available yet' });
    if (!['shipped', 'out_for_delivery', 'delivered'].includes(String(order.status))) {
      return res.json({
        order,
        tracking: buildDtdcOrderStatusTracking(order, 'DTDC live tracking will be available after dispatch.'),
      });
    }

    const tracking = await trackDtdcShipment({ trackingId: order.trackingId });
    return res.json({ order, tracking });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to fetch DTDC tracking' });
  }
});

router.get('/admin/dtdc/track/:lookup', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const row = await findOrderByLookup(req.params.lookup);
    if (!row) {
      const trackingId = String(req.params.lookup || '').trim();
      if (!trackingId) return res.status(400).json({ message: 'Tracking ID is required' });
      const tracking = await trackDtdcShipment({ trackingId });
      return res.json({ order: null, tracking });
    }

    const order = mapOrderRow(row);
    const trackingId = order.trackingId || String(req.params.lookup || '').trim();
    if (!trackingId) return res.status(400).json({ message: 'Tracking ID is required' });

    const tracking = await trackDtdcShipment({ trackingId });
    return res.json({ order, tracking });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to fetch DTDC tracking' });
  }
});

router.post('/dtdc/pincode', async (req, res) => {
  try {
    const result = await checkDtdcPincode({
      orgPincode: req.body?.orgPincode,
      desPincode: req.body?.desPincode,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to check DTDC pincode' });
  }
});

router.post('/admin/dtdc/pincode', auth, adminOnly, async (req, res) => {
  try {
    const result = await checkDtdcPincode({
      orgPincode: req.body?.orgPincode,
      desPincode: req.body?.desPincode,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to check DTDC pincode' });
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

router.get('/track-by-id/:trackingId', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const trackingId = req.params.trackingId;
    const rows = await dbQuery<any>(
      'SELECT * FROM orders WHERE LOWER(tracking_id) = LOWER(?) ORDER BY updated_at DESC, id DESC LIMIT 1',
      [trackingId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Order not found' });
    res.json(mapOrderRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);
    const estimatedDelivery = getEstimatedDeliveryDate(max);

    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const data = req.body || {};
    const customerEmail = String(data.customerEmail || '').trim().toLowerCase();
    if (!customerEmail) return res.status(400).json({ message: 'Customer email is required' });
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
    if (!emailValid) return res.status(400).json({ message: 'Enter a valid customer email' });

    const priced = await priceAndValidateOrderItems(data.items || []);
    if (!priced.ok) return res.status(400).json({ message: priced.message });

    const settings = await getCheckoutSettings();
    const baseTotals = computeTotals(priced.itemsSubtotal, settings);
    const paymentMethod = String(data.paymentMethod || '').trim();
    const wantsCod = /^cod$/i.test(paymentMethod) || /cash\s*on\s*delivery/i.test(paymentMethod);
    let codAmount = 0;
    let codAvailable: boolean | null = null;
    let codPincode: string | null = null;
    let codMessage: string | null = null;

    if (wantsCod) {
      if (hasPrasadamItems(priced.items)) {
        return res.status(400).json({ message: 'COD is not available for Prasadam products. Please use online payment for Prasadam orders.' });
      }
      if (!settings.codEnabled) {
        return res.status(400).json({ message: 'COD is currently disabled' });
      }
      const deliveryPincode = String(data.shippingAddress?.pincode || data.billingAddress?.pincode || '').trim();
      if (!/^\d{6}$/.test(deliveryPincode)) {
        return res.status(400).json({ message: 'A valid 6 digit delivery pincode is required for COD' });
      }
      const dtdc = await checkDtdcPincode({ desPincode: deliveryPincode });
      codAvailable = Boolean(dtdc.serviceable && dtdc.codAvailable);
      codPincode = deliveryPincode;
      codMessage = dtdc.message || (codAvailable ? 'COD available for this pincode' : 'COD not available for this pincode');
      if (!codAvailable) {
        return res.status(400).json({ message: codMessage || 'COD is not available for this pincode' });
      }
      codAmount = COD_CHARGE;
    }

    const totals = { ...baseTotals, cod: codAmount, total: baseTotals.total + codAmount };
    if (settings.minOrderAmount && totals.total < settings.minOrderAmount) {
      return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
    }
    if (settings.maxOrderQuantity) {
      const totalQty = priced.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      if (totalQty > settings.maxOrderQuantity) {
        return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
      }
    }

    const status = data.status || 'confirmed';
    const statusHistory = Array.isArray(data.statusHistory) && data.statusHistory.length
      ? data.statusHistory
      : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];

    const result: any = await dbExecute(
      'INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, shipping_service, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user?.id || null,
        JSON.stringify(priced.items),
        totals.itemsSubtotal,
        totals.packaging,
        settings.packagingRate,
        totals.shipping,
        codAmount,
        codAvailable,
        codPincode,
        codMessage,
        totals.total,
        status,
        data.customerName || null,
        customerEmail,
        JSON.stringify(data.shippingAddress || {}),
        JSON.stringify(data.billingAddress || {}),
        wantsCod ? 'COD' : paymentMethod,
        null,
        null,
        estimatedDelivery,
        JSON.stringify(statusHistory),
      ]
    );

    const orderId = result.insertId;

    // Persist latest checkout address as the user's default address (best-effort).
    const numericUserId = Number(req.user?.id);
    if (Number.isFinite(numericUserId)) {
      const addrToSave = data.shippingAddress || data.billingAddress;
      upsertUserDefaultAddress(numericUserId, addrToSave).catch(() => {});
    }

    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    const order = mapOrderRow(rows[0]);

    if (order.customerEmail) {
      sendOrderConfirmation(order.customerEmail, {
        orderId: String(order.orderId),
        total: order.total,
        itemsCount: order.items?.length || 0,
        eta: etaText,
        items: order.items,
        itemsSubtotal: order.itemsSubtotal,
        shippingAmount: order.shippingAmount,
        packagingAmount: order.packagingAmount,
        packagingRate: order.packagingRate,
        codAmount: order.codAmount,
        codPincode: order.codPincode,
        codAvailable: order.codAvailable,
        codMessage: order.codMessage,
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
    const { status, note, shippingService, trackingId } = req.body;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Order not found' });

    const history = parseJson<Array<{ status: string; date: string; note?: string }>>(row.status_history, []);

    const nextStatus = status || row.status;
    const nextShippingService = (shippingService !== undefined ? shippingService : row.shipping_service) ?? null;

    let nextTrackingId: string | null | undefined = undefined;
    if (trackingId !== undefined) {
      const cleaned = String(trackingId).trim();
      if (!cleaned) {
        nextTrackingId = null;
      } else {
        nextTrackingId = cleaned;
      }
    }

    if (nextTrackingId) {
      const duplicateRows = await dbQuery<any>(
        'SELECT id FROM orders WHERE LOWER(tracking_id) = LOWER(?) AND id <> ? LIMIT 1',
        [nextTrackingId, req.params.id]
      );
      if (duplicateRows[0]) {
        return res.status(409).json({ message: `Tracking ID ${nextTrackingId} is already assigned to another order` });
      }
    }

    const trackingChanged = nextTrackingId !== undefined && (row.tracking_id ?? null) !== nextTrackingId;
    const statusChanged = nextStatus !== row.status;

    if (statusChanged || trackingChanged) {
      history.push({ status: nextStatus, date: new Date().toISOString(), note });
    }

    const updateWithShippingService = async () => {
      if (nextTrackingId === undefined) {
        await dbExecute(
          'UPDATE orders SET status = ?, shipping_service = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
          [nextStatus, nextShippingService, JSON.stringify(history), req.params.id]
        );
      } else {
        await dbExecute(
          'UPDATE orders SET status = ?, tracking_id = ?, shipping_service = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
          [nextStatus, nextTrackingId, nextShippingService, JSON.stringify(history), req.params.id]
        );
      }
    };

    const updateWithoutShippingService = async () => {
      if (nextTrackingId === undefined) {
        await dbExecute(
          'UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
          [nextStatus, JSON.stringify(history), req.params.id]
        );
      } else {
        await dbExecute(
          'UPDATE orders SET status = ?, tracking_id = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
          [nextStatus, nextTrackingId, JSON.stringify(history), req.params.id]
        );
      }
    };

    try {
      await updateWithShippingService();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes("Unknown column 'shipping_service'")) {
        await updateWithoutShippingService();
      } else {
        throw err;
      }
    }

    const updatedRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
    const order = mapOrderRow(updatedRows[0]);

    if (order.customerEmail) {
      const { min, max } = await getEtaConfig();
      const etaText = getEtaText(min, max);
      sendShippingUpdate(order.customerEmail, {
        orderId: String(order.orderId),
        status: nextStatus,
        trackingId: order.trackingId,
        eta: etaText,
        details: {
          items: order.items,
          total: order.total,
          itemsSubtotal: order.itemsSubtotal,
          shippingAmount: order.shippingAmount,
          packagingAmount: order.packagingAmount,
          packagingRate: order.packagingRate,
          codAmount: order.codAmount,
          codPincode: order.codPincode,
          codAvailable: order.codAvailable,
          codMessage: order.codMessage,
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
