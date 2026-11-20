import type { Response } from 'express';
import crypto from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AuthRequest } from '../middleware/auth';
import { isDbConnected, withDbTransaction } from './db';
import { getEtaConfig, getEstimatedDeliveryDate } from './eta';
import { capturePurchaseOrderContext } from './purchaseTracking';
import { applyCouponToTotals, computeTotals, getCheckoutSettings, hasPrasadamItems, priceAndValidateOrderItems } from './orderPricing';
import { upsertUserDefaultAddress } from './userAddress';
import { resolveCodHandleFee } from './cod';
import { validateCheckoutOrderContact } from './checkoutValidation';
import { reserveInventoryForOrder } from './inventory';

type Checkout = {
  token: string;
  amount: number;
  orderId: number;
  expiresAt: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: Record<string, any>;
  alreadyPaid: boolean;
  created: boolean;
};

type CheckoutGateway = {
  method: 'PayU' | 'Cashfree';
  minimumAmount?: number;
  prepare: () => (checkout: Checkout) => Promise<object> | object;
  createToken: (orderId: number) => string;
  respondToFailure: (res: Response, error: unknown) => boolean;
};

export const createOnlineCheckout = (gateway: CheckoutGateway) => async (req: AuthRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const openCheckout = gateway.prepare();
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { amount, order, customer } = req.body || {};
    if (!order || !customer?.email || !customer?.name) return res.status(400).json({ message: 'Missing order details' });
    const customerEmail = String(customer.email || '').trim().toLowerCase();
    const contact = validateCheckoutOrderContact(order, customerEmail);
    if (!contact.ok) return res.status(400).json({ message: contact.message });

    const priced = await priceAndValidateOrderItems(order.items || []);
    if (!priced.ok) return res.status(400).json({ message: priced.message });
    if ((Boolean(order?.codRequested) || Number(order?.codAmount || 0) > 0) && hasPrasadamItems(priced.items)) {
      return res.status(400).json({ message: 'COD is not available for Prasadam products. Please use online payment for Prasadam orders.' });
    }

    const settings = await getCheckoutSettings();
    const baseTotals = computeTotals(priced.itemsSubtotal, settings);
    const cod = await resolveCodHandleFee({ ...order, items: priced.items }, settings);
    const totalsBeforeCoupon = { ...baseTotals, cod: cod.amount, total: baseTotals.total + cod.amount };
    let totals = totalsBeforeCoupon;
    let couponDetails: any = null;
    if (order?.couponCode) {
      const couponResult = await applyCouponToTotals(order.couponCode, priced.items, totalsBeforeCoupon);
      if (!couponResult.valid) return res.status(400).json({ message: couponResult.message });
      totals = { ...totalsBeforeCoupon, total: couponResult.totals.total };
      couponDetails = couponResult.coupon;
    }
    if (settings.minOrderAmount && totals.total < settings.minOrderAmount) return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
    if (gateway.minimumAmount && totals.total < gateway.minimumAmount) {
      return res.status(400).json({ message: `${gateway.method} requires an order total of at least ₹${gateway.minimumAmount}.` });
    }
    if (settings.maxOrderQuantity) {
      const totalQty = priced.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      if (totalQty > settings.maxOrderQuantity) return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
    }
    if (amount !== undefined && Number.isFinite(Number(amount)) && Math.abs(Number(amount) - totals.total) > 0.01) {
      return res.status(400).json({ message: 'Cart total changed. Please refresh and try again.' });
    }

    const cartHash = crypto.createHash('sha256').update(JSON.stringify({
      customerEmail,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      shippingAddress: contact.shippingAddress,
      billingAddress: contact.billingAddress,
      items: priced.items.map((item) => ({ productId: item.productId, quantity: item.quantity, selectedSize: item.selectedSize || '', selectedPieces: item.selectedPieces || '', selectedAttributes: item.selectedAttributes || {}, price: item.price })),
      totals,
      couponCode: couponDetails?.code || '',
      codAmount: cod.amount,
    })).digest('hex');
    const rawKey = String(req.body?.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 112);
    const idempotencyKey = gateway.method.toLowerCase() + ':' + (rawKey || crypto.randomUUID());
    const rawUserId = req.user?.id;
    const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
    const { max } = await getEtaConfig();
    const estimatedDelivery = getEstimatedDeliveryDate(max);
    const orderData = {
      ...order,
      userId: numericUserId,
      items: priced.items,
      itemsSubtotal: totals.itemsSubtotal,
      packagingAmount: totals.packaging,
      packagingRate: settings.packagingRate,
      shippingAmount: totals.shipping,
      codAvailable: cod.available,
      codPincode: cod.pincode,
      codMessage: cod.message,
      couponCode: couponDetails?.code || null,
      couponDiscount: couponDetails?.discountAmount || 0,
      couponDetails,
      total: totals.total,
      customerName: customer.name,
      customerEmail,
      shippingAddress: contact.shippingAddress,
      billingAddress: contact.billingAddress,
    };
    const history = [{ status: 'pending_payment', date: new Date().toISOString(), note: gateway.method + ' payment initiated, waiting for payment confirmation' }];
    const checkoutContact = {
      customerName: String(customer.name).trim(),
      customerEmail,
      customerPhone: contact.billingAddress.mobile,
      billingAddress: contact.billingAddress,
    };

    const saved = await withDbTransaction(async (connection) => {
      // The unique session key serializes submissions for the same cart and gateway.
      await connection.execute(
        'INSERT INTO checkout_sessions (idempotency_key, user_id, customer_email, cart_hash, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 45 MINUTE)) ON DUPLICATE KEY UPDATE id = id',
        [idempotencyKey, numericUserId, customerEmail, cartHash]
      );
      const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT *, UNIX_TIMESTAMP(expires_at) AS expires_epoch FROM checkout_sessions WHERE idempotency_key = ? FOR UPDATE',
        [idempotencyKey]
      );
      const session = rows[0];
      if (String(session.cart_hash) !== cartHash || (session.user_id == null ? null : Number(session.user_id)) !== numericUserId) return null;
      if (session.order_id && session.payment_token) {
        const [payments] = await connection.query<RowDataPacket[]>(
          'SELECT method, status FROM payment_status WHERE token = ? LIMIT 1', [session.payment_token]
        );
        const status = payments[0]?.method === gateway.method ? payments[0]?.status : null;
        const expiresAt = Number(session.expires_epoch) * 1000;
        if (status === 'paid' || (status === 'pending' && (gateway.method === 'Cashfree' || expiresAt > Date.now()))) {
          return {
            orderId: Number(session.order_id), token: String(session.payment_token), amount: Number(session.amount),
            expiresAt, alreadyPaid: status === 'paid', created: false,
          };
        }
      }
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, coupon_code, coupon_discount, coupon_details, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          orderData.userId || null, JSON.stringify(orderData.items || []), orderData.itemsSubtotal, orderData.packagingAmount,
          orderData.packagingRate, orderData.shippingAmount, 0, orderData.codAvailable, orderData.codPincode || null,
          orderData.codMessage || null, orderData.couponCode || null, orderData.couponDiscount || 0,
          orderData.couponDetails ? JSON.stringify(orderData.couponDetails) : null, orderData.total, 'pending_payment',
          orderData.customerName || null, orderData.customerEmail || null, JSON.stringify(orderData.shippingAddress || {}),
          JSON.stringify(orderData.billingAddress || {}), gateway.method, null, estimatedDelivery, JSON.stringify(history),
        ]
      );
      const orderId = result.insertId;
      await reserveInventoryForOrder(connection, orderId, priced.items);
      const token = gateway.createToken(orderId);
      const orderAmount = Number(totals.total);
      await connection.execute(
        'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, checkoutContact.customerName, customerEmail, gateway.method, orderAmount, 'pending', token]
      );
      await connection.execute(
        'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?)',
        [token, 'pending', orderId, orderAmount, gateway.method, null]
      );
      const expiresAt = Math.floor(Date.now() / 1000) * 1000 + 45 * 60_000;
      await connection.execute(
        "UPDATE checkout_sessions SET order_id = ?, payment_token = ?, amount = ?, status = 'active', expires_at = FROM_UNIXTIME(?) WHERE id = ?",
        [orderId, token, orderAmount, expiresAt / 1000, session.id]
      );
      return { orderId, token, amount: orderAmount, expiresAt, alreadyPaid: false, created: true };
    });
    if (!saved) return res.status(409).json({ message: 'Checkout session changed. Please refresh your cart and try again.' });

    if (saved.created) {
      capturePurchaseOrderContext(saved.orderId, {
        ...(req.body?.metaContext && typeof req.body.metaContext === 'object' ? req.body.metaContext : {}),
        externalId: numericUserId ? 'user:' + numericUserId : customerEmail,
      }, req).catch(() => {});
      if (numericUserId) upsertUserDefaultAddress(numericUserId, contact.shippingAddress).catch(() => {});
    }
    const checkout = await openCheckout({ ...saved, ...checkoutContact });
    return res.json({ ...checkout, statusToken: saved.token, orderId: saved.orderId });
  } catch (error) {
    if (gateway.respondToFailure(res, error)) return;
    console.error(gateway.method + ' checkout preparation failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to start payment checkout' });
  }
};
