import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { sendOrderConfirmation, sendShippingUpdate } from '../lib/email';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { auth, adminOnly, optionalAuth, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString } from '../lib/dbHelpers';
import { applyCouponToTotals, computeTotals, getCheckoutSettings, hasPrasadamItems, markCouponUsed, priceAndValidateOrderItems } from '../lib/orderPricing';
import { upsertUserDefaultAddress } from '../lib/userAddress';
import { checkDeliveryServicePincode, getAdminCodConfig, getCodEligibilityForItems, ensureDeliveryServiceSchema, trackDeliveryServiceShipment } from '../lib/deliveryService';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import { validateCheckoutOrderContact } from '../lib/checkoutValidation';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { convertReservationToSale, releaseInventoryForOrder, reserveInventoryForOrder } from '../lib/inventory';
import { insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();
const codOrderLimiter = rateLimit('cod-order-create', {
  windowMs: 15 * 60 * 1000,
  max: 6,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many order attempts. Please wait before trying again.',
});
const pincodeCheckLimiter = rateLimit('delivery-pincode-check', {
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many pincode checks. Please wait before trying again.',
});

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
  couponCode: row.coupon_code ?? undefined,
  couponDiscount: row.coupon_discount == null ? undefined : Number(row.coupon_discount),
  couponDetails: parseJson(row.coupon_details, null),
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

const mapPublicTrackingOrder = (row: any) => {
  const order = mapOrderRow(row);
  return {
    orderId: order.orderId,
    status: order.status,
    orderDate: order.createdAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    estimatedDelivery: order.estimatedDelivery,
    trackingId: order.trackingId,
    shippingService: order.shippingService,
    paymentMethod: order.paymentMethod,
    paymentStatus: String(order.paymentMethod || '').toLowerCase() === 'cod' ? 'cod' : undefined,
    items: (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
      productId: item.productId || item.id || item._id,
      slug: item.slug,
      name: item.name,
      image: item.image,
      category: item.category,
      quantity: item.quantity,
    })),
    statusHistory: (Array.isArray(order.statusHistory) ? order.statusHistory : []).map((entry: any) => ({
      status: entry.status,
      date: entry.date,
      note: entry.note,
    })),
  };
};

const getSearchTerm = (value: unknown) => String(value || '').trim().toLowerCase();
const likeSearch = (term: string) => `%${term}%`;

router.get('/my', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const email = String(req.user?.email || '').trim().toLowerCase();
    if (email) {
      const rows = await dbQuery<any>(
        `SELECT * FROM orders
         WHERE (user_id = ? OR (user_id IS NULL AND LOWER(customer_email) = ?))
           AND ${merchantOrderWhereSql('orders')}
         ORDER BY created_at DESC`,
        [req.user?.id, email]
      );
      return res.json(rows.map(mapOrderRow));
    }
    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE user_id = ?
         AND ${merchantOrderWhereSql('orders')}
       ORDER BY created_at DESC`,
      [req.user?.id]
    );
    res.json(rows.map(mapOrderRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const search = getSearchTerm(req.query.search);
    const params: any[] = [];
    const searchSql = search
      ? `AND (
          CAST(id AS CHAR) LIKE ?
          OR LOWER(COALESCE(customer_name, '')) LIKE ?
          OR LOWER(COALESCE(customer_email, '')) LIKE ?
          OR LOWER(COALESCE(tracking_id, '')) LIKE ?
          OR LOWER(COALESCE(payment_method, '')) LIKE ?
          OR LOWER(CAST(shipping_address AS CHAR)) LIKE ?
          OR LOWER(CAST(billing_address AS CHAR)) LIKE ?
          OR LOWER(CAST(items AS CHAR)) LIKE ?
        )`
      : '';
    if (search) params.push(...Array(8).fill(likeSearch(search)));

    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE ${merchantOrderWhereSql('orders')}
       ${searchSql}
       ORDER BY created_at DESC`
      , params
    );
    res.json(rows.map(mapOrderRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin/pending-payments', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const search = getSearchTerm(req.query.search);
    const params: any[] = [];
    const searchSql = search
      ? `AND (
          CAST(o.id AS CHAR) LIKE ?
          OR LOWER(COALESCE(o.customer_name, '')) LIKE ?
          OR LOWER(COALESCE(o.customer_email, '')) LIKE ?
          OR LOWER(COALESCE(o.payment_method, '')) LIKE ?
          OR LOWER(COALESCE(ps.token, '')) LIKE ?
          OR LOWER(COALESCE(p.transaction_id, '')) LIKE ?
          OR LOWER(CAST(o.shipping_address AS CHAR)) LIKE ?
          OR LOWER(CAST(o.billing_address AS CHAR)) LIKE ?
          OR LOWER(CAST(o.items AS CHAR)) LIKE ?
        )`
      : '';
    if (search) params.push(...Array(9).fill(likeSearch(search)));

    const rows = await dbQuery<any>(`
      SELECT
        o.*,
        ps.token AS payment_token,
        ps.status AS payment_status,
        ps.updated_at AS payment_updated_at,
        p.transaction_id,
        p.created_at AS payment_created_at
      FROM orders o
      JOIN payment_status ps ON ps.order_id = o.id
      LEFT JOIN payments p ON p.order_id = o.id AND p.transaction_id = ps.token
      WHERE ps.status IN ('pending', 'failed')
        AND LOWER(o.payment_method) NOT IN ('cod', 'cash on delivery')
        AND NOT EXISTS (
          SELECT 1 FROM payments paid_p
          WHERE paid_p.order_id = o.id AND paid_p.status = 'paid'
        )
        AND NOT EXISTS (
          SELECT 1 FROM payment_status paid_ps
          WHERE paid_ps.order_id = o.id AND paid_ps.status = 'paid'
        )
        ${searchSql}
      ORDER BY ps.updated_at DESC, o.updated_at DESC
    `, params);

    res.json(rows.map((row) => {
      const order = mapOrderRow(row);
      const shippingAddress = (order.shippingAddress || {}) as Record<string, any>;
      const billingAddress = (order.billingAddress || {}) as Record<string, any>;
      return {
        ...order,
        paymentToken: row.payment_token || undefined,
        paymentStatus: row.payment_status || 'pending',
        paymentUpdatedAt: toIsoString(row.payment_updated_at),
        paymentCreatedAt: toIsoString(row.payment_created_at),
        transactionId: row.transaction_id || undefined,
        customerName: order.customerName || shippingAddress.fullName || billingAddress.fullName || '',
        customerEmail: order.customerEmail || '',
        customerPhone: shippingAddress.mobile || billingAddress.mobile || '',
        customerAddress: shippingAddress,
      };
    }));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

const findOrderByLookup = async (lookup: string) => {
  const input = String(lookup || '').trim();
  if (!input) return null;
  const rows = await dbQuery<any>(
    `SELECT * FROM orders
     WHERE (LOWER(tracking_id) = LOWER(?) OR id = ?)
       AND ${merchantOrderWhereSql('orders')}
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`,
    [input, /^\d+$/.test(input) ? Number(input) : -1]
  );
  return rows[0] || null;
};

const buildDeliveryPartnerOrderStatusTracking = (order: ReturnType<typeof mapOrderRow>, message: string) => ({
  carrier: order.shippingService || process.env.DELIVERY_PARTNER_NAME || 'Delivery Service Partner',
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

const handleDeliveryPartnerTrack = async (req: any, res: any, isAdmin = false) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const row = await findOrderByLookup(req.params.lookup);
    if (!row) {
      const trackingId = String(req.params.lookup || '').trim();
      if (!trackingId) return res.status(isAdmin ? 400 : 404).json({ message: isAdmin ? 'Tracking ID is required' : 'Order not found' });
      const tracking = await trackDeliveryServiceShipment({ trackingId });
      return res.json({ order: null, tracking });
    }

    const order = mapOrderRow(row);
    const trackingId = order.trackingId || String(req.params.lookup || '').trim();
    if (!trackingId) return res.status(400).json({ message: 'Tracking ID is required' });
    if (!isAdmin && !['shipped', 'out_for_delivery', 'delivered'].includes(String(order.status))) {
      return res.json({
        order: mapPublicTrackingOrder(row),
        tracking: buildDeliveryPartnerOrderStatusTracking(order, 'Live tracking will be available after dispatch.'),
      });
    }

    const tracking = await trackDeliveryServiceShipment({ trackingId });
    return res.json({ order: isAdmin ? order : mapPublicTrackingOrder(row), tracking });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to fetch delivery partner tracking' });
  }
};

router.get('/delivery-service/track/:lookup', async (req, res) => {
  return handleDeliveryPartnerTrack(req, res, false);
});

router.get('/admin/delivery-service/track/:lookup', auth, adminOnly, async (req, res) => {
  return handleDeliveryPartnerTrack(req, res, true);
});

router.post('/delivery-service/pincode', pincodeCheckLimiter, async (req, res) => {
  try {
    const result = await checkDeliveryServicePincode({ desPincode: req.body?.desPincode });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err?.message || 'Unable to check delivery pincode' });
  }
});

router.post('/admin/delivery-service/pincode', auth, adminOnly, async (req, res) => {
  try {
    const result = await checkDeliveryServicePincode({ desPincode: req.body?.desPincode });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to check delivery pincode' });
  }
});

router.get('/admin/cod-config', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getAdminCodConfig());
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to load COD settings' });
  }
});

router.put('/admin/cod-config', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureDeliveryServiceSchema();
    const categoryIds = Array.isArray(req.body?.categoryIds) ? req.body.categoryIds.map((id: any) => Number(id)).filter(Number.isFinite) : [];
    const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds.map((id: any) => Number(id)).filter(Number.isFinite) : [];
    const enabled = req.body?.enabled !== false;
    const inherit = Boolean(req.body?.inherit);

    if (categoryIds.length) {
      await dbExecute(
        `UPDATE categories SET cod_enabled = ?, updated_at = NOW() WHERE id IN (${categoryIds.map(() => '?').join(',')})`,
        [enabled ? 1 : 0, ...categoryIds]
      );
    }
    if (productIds.length) {
      await dbExecute(
        `UPDATE products SET cod_enabled = ?, updated_at = NOW() WHERE id IN (${productIds.map(() => '?').join(',')})`,
        [inherit ? null : enabled ? 1 : 0, ...productIds]
      );
    }

    await insertAdminAuditLog(null, {
      req,
      action: 'COD_RULE_UPDATE',
      entityType: 'delivery_cod',
      entityId: 'bulk',
      after: { categoryIds, productIds, enabled, inherit },
      reason: 'COD eligibility updated',
    }).catch(() => {});
    res.json(await getAdminCodConfig());
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to save COD settings' });
  }
});

router.post('/admin/cod-config/pincodes', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureDeliveryServiceSchema();
    const pincodes = String(req.body?.pincodes || req.body?.pincode || '')
      .split(/[\s,]+/)
      .map((p) => p.replace(/\D/g, ''))
      .filter((p) => /^\d{6}$/.test(p));
    if (!pincodes.length) return res.status(400).json({ message: 'Enter at least one valid 6 digit pincode' });
    const deliveryEnabled = req.body?.deliveryEnabled !== false ? 1 : 0;
    const codEnabled = req.body?.codEnabled !== false ? 1 : 0;
    const partnerName = String(req.body?.partnerName || 'Delivery Service Partner').trim().slice(0, 120);
    const note = String(req.body?.note || '').trim().slice(0, 255) || null;

    for (const pincode of Array.from(new Set(pincodes))) {
      await dbExecute(
        `INSERT INTO delivery_pincode_rules (pincode, delivery_enabled, cod_enabled, partner_name, note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE delivery_enabled = VALUES(delivery_enabled), cod_enabled = VALUES(cod_enabled), partner_name = VALUES(partner_name), note = VALUES(note), updated_at = NOW()`,
        [pincode, deliveryEnabled, codEnabled, partnerName, note]
      );
    }

    await insertAdminAuditLog(null, {
      req,
      action: 'COD_PINCODE_UPDATE',
      entityType: 'delivery_pincode_rule',
      entityId: 'bulk',
      after: { pincodes, deliveryEnabled: Boolean(deliveryEnabled), codEnabled: Boolean(codEnabled), partnerName, note },
      reason: 'COD pincode rules updated',
    }).catch(() => {});
    res.json(await getAdminCodConfig());
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to save pincode rules' });
  }
});

router.delete('/admin/cod-config/pincodes/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureDeliveryServiceSchema();
    await dbExecute('DELETE FROM delivery_pincode_rules WHERE id = ?', [req.params.id]);
    await insertAdminAuditLog(null, {
      req,
      action: 'COD_PINCODE_DELETE',
      entityType: 'delivery_pincode_rule',
      entityId: req.params.id,
      reason: 'COD pincode rule removed',
    }).catch(() => {});
    res.json(await getAdminCodConfig());
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Unable to remove pincode rule' });
  }
});

router.get('/track/:orderId', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const orderId = parseInt(req.params.orderId, 10);
    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE id = ?
         AND ${merchantOrderWhereSql('orders')}
       LIMIT 1`,
      [orderId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Order not found' });
    res.json(mapPublicTrackingOrder(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/track-by-id/:trackingId', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const trackingId = req.params.trackingId;
    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE LOWER(tracking_id) = LOWER(?)
         AND ${merchantOrderWhereSql('orders')}
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [trackingId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Order not found' });
    res.json(mapPublicTrackingOrder(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', codOrderLimiter, optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);
    const estimatedDelivery = getEstimatedDeliveryDate(max);

    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const data = req.body || {};
    const customerEmail = String(data.customerEmail || '').trim().toLowerCase();
    if (!customerEmail) return res.status(400).json({ message: 'Customer email is required' });
    const contact = validateCheckoutOrderContact(data, customerEmail);
    if (!contact.ok) return res.status(400).json({ message: contact.message });

    const priced = await priceAndValidateOrderItems(data.items || []);
    if (!priced.ok) return res.status(400).json({ message: priced.message });

    const settings = await getCheckoutSettings();
    const baseTotals = computeTotals(priced.itemsSubtotal, settings);
    const paymentMethod = String(data.paymentMethod || '').trim();
    const wantsCod = /^cod$/i.test(paymentMethod) || /cash\s*on\s*delivery/i.test(paymentMethod);
    if (!wantsCod) {
      return res.status(400).json({
        message: 'Online orders must be created through Razorpay verification routes.',
      });
    }
    let codAmount = 0;
    let codAvailable: boolean | null = null;
    let codPincode: string | null = null;
    let codMessage: string | null = null;

    if (wantsCod) {
      if (hasPrasadamItems(priced.items)) {
        return res.status(400).json({ message: 'COD is not available for Prasadam products. Please use online payment for Prasadam orders.' });
      }
      const eligibility = await getCodEligibilityForItems(priced.items);
      if (!eligibility.eligible) {
        return res.status(400).json({ message: eligibility.message });
      }
      const deliveryPincode = String(contact.shippingAddress.pincode || contact.billingAddress.pincode || '').trim();
      if (!/^\d{6}$/.test(deliveryPincode)) {
        return res.status(400).json({ message: 'A valid 6 digit delivery pincode is required for COD' });
      }
      const delivery = await checkDeliveryServicePincode({ desPincode: deliveryPincode });
      codAvailable = Boolean(delivery.serviceable && delivery.codAvailable);
      codPincode = deliveryPincode;
      codMessage = delivery.message || (codAvailable ? 'COD available for this pincode' : 'COD not available for this pincode');
      if (!codAvailable) {
        return res.status(400).json({ message: codMessage || 'COD is not available for this pincode' });
      }
      codAmount = Math.max(0, Number(settings.codFee ?? 40) || 0);
    }

    const totalsBeforeCoupon = { ...baseTotals, cod: codAmount, total: baseTotals.total + codAmount };
    let totals = totalsBeforeCoupon;
    let couponDetails: any = null;
    if (data.couponCode) {
      const couponResult = await applyCouponToTotals(data.couponCode, priced.items, totalsBeforeCoupon);
      if (!couponResult.valid) return res.status(400).json({ message: couponResult.message });
      totals = { ...totalsBeforeCoupon, total: couponResult.totals.total };
      couponDetails = couponResult.coupon;
    }
    if (settings.minOrderAmount && totals.total < settings.minOrderAmount) {
      return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
    }
    if (settings.maxOrderQuantity) {
      const totalQty = priced.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      if (totalQty > settings.maxOrderQuantity) {
        return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
      }
    }

    const status = 'confirmed';
    const statusHistory = [{ status, date: new Date().toISOString(), note: 'COD order placed successfully' }];

    const result: any = await dbExecute(
      'INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, coupon_code, coupon_discount, coupon_details, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, shipping_service, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        couponDetails?.code || null,
        couponDetails?.discountAmount || 0,
        couponDetails ? JSON.stringify(couponDetails) : null,
        totals.total,
        status,
        data.customerName || null,
        customerEmail,
        JSON.stringify(contact.shippingAddress),
        JSON.stringify(contact.billingAddress),
        wantsCod ? 'COD' : paymentMethod,
        null,
        null,
        estimatedDelivery,
        JSON.stringify(statusHistory),
      ]
    );

    const orderId = result.insertId;
    try {
      await withDbTransaction((connection) => reserveInventoryForOrder(connection, Number(orderId), priced.items));
    } catch (err) {
      await dbExecute(
        'UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
        ['cancelled', JSON.stringify([...statusHistory, { status: 'cancelled', date: new Date().toISOString(), note: 'Inventory reservation failed' }]), orderId]
      ).catch(() => {});
      throw err;
    }
    if (couponDetails?.code) {
      await markCouponUsed(couponDetails.code);
    }

    // Persist latest checkout address as the user's default address (best-effort).
    const numericUserId = Number(req.user?.id);
    if (Number.isFinite(numericUserId)) {
      const addrToSave = contact.shippingAddress || contact.billingAddress;
      upsertUserDefaultAddress(numericUserId, addrToSave).catch(() => {});
    }

    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE id = ?
         AND ${merchantOrderWhereSql('orders')}
       LIMIT 1`,
      [orderId]
    );
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
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        couponDetails: order.couponDetails,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
      }).catch(() => {});
    }
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    const { status, note, shippingService, trackingId } = req.body;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE id = ?
         AND ${merchantOrderWhereSql('orders')}
       LIMIT 1`,
      [req.params.id]
    );
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

    if (statusChanged) {
      const orderItems = parseJson(row.items, []);
      if (nextStatus === 'cancelled') {
        await withDbTransaction((connection) => releaseInventoryForOrder(connection, Number(req.params.id), orderItems)).catch(() => {});
      }
      if (nextStatus === 'delivered' && String(row.status || '') !== 'delivered') {
        await withDbTransaction((connection) => convertReservationToSale(connection, Number(req.params.id), orderItems)).catch(() => {});
      }
    }

    const updatedRows = await dbQuery<any>(
      `SELECT * FROM orders
       WHERE id = ?
         AND ${merchantOrderWhereSql('orders')}
       LIMIT 1`,
      [req.params.id]
    );
    const order = mapOrderRow(updatedRows[0]);
    await insertAdminAuditLog(null, {
      req,
      action: statusChanged ? 'ORDER_STATUS_UPDATE' : 'ORDER_FULFILLMENT_UPDATE',
      entityType: 'order',
      entityId: req.params.id,
      before: {
        status: row.status,
        trackingId: row.tracking_id || null,
        shippingService: row.shipping_service || null,
      },
      after: {
        status: updatedRows[0].status,
        trackingId: updatedRows[0].tracking_id || null,
        shippingService: updatedRows[0].shipping_service || null,
      },
      reason: String(note || (statusChanged ? `Status changed to ${nextStatus}` : 'Order fulfillment details updated')).slice(0, 255),
    }).catch(() => {});

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
