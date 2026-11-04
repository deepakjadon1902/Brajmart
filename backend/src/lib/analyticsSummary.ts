import { parseJson } from './dbHelpers';

export type AnalyticsOrderRow = {
  id: string | number;
  total: unknown;
  status: string;
  payment_method: string;
  created_at: string | Date;
  items?: unknown;
  items_subtotal?: unknown;
  shipping_amount?: unknown;
  packaging_amount?: unknown;
  cod_amount?: unknown;
  coupon_discount?: unknown;
};

export type AnalyticsPaymentRow = {
  origin: 'payment' | 'status';
  record_id: string | number;
  order_id: string | number;
  amount: unknown;
  status: string;
  created_at: string | Date;
  updated_at?: string | Date;
};

export type CollectedRevenueEntry = { orderId: string; date: Date; amount: number; source: 'online' | 'cod' };
const isCod = (method: string) => ['cod', 'cash on delivery'].includes(String(method || '').trim().toLowerCase());
const cents = (value: unknown) => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
};
const timestamp = (value: string | Date | undefined) => value ? new Date(value).getTime() : NaN;
const paymentTime = (payment: AnalyticsPaymentRow) => {
  const updated = timestamp(payment.updated_at);
  return Number.isFinite(updated) ? updated : timestamp(payment.created_at);
};

// One checkout payment per order. Prefer the payments ledger over its status
// mirror, retain the latest final record, and never resurrect a refunded payment
// from an older paid status. Pending/failed attempts don't shadow a later receipt.
export const collectedOrderPayments = (orders: AnalyticsOrderRow[], payments: AnalyticsPaymentRow[], asOf?: Date) => {
  const byOrder = new Map(orders.map((order) => [String(order.id), order]));
  const latest = new Map<string, AnalyticsPaymentRow>();
  for (const payment of payments) {
    if (!byOrder.has(String(payment.order_id)) || !['paid', 'refunded'].includes(payment.status)) continue;
    const key = `${payment.origin}:${payment.order_id}`;
    const previous = latest.get(key);
    const time = paymentTime(payment);
    if (asOf && time > asOf.getTime()) continue;
    const previousTime = previous ? paymentTime(previous) : NaN;
    if (!previous || (Number.isFinite(time) && (!Number.isFinite(previousTime) || time > previousTime))
      || (time === previousTime && String(payment.record_id).localeCompare(String(previous.record_id), 'en', { numeric: true }) > 0)) latest.set(key, payment);
  }
  const entries: CollectedRevenueEntry[] = [];
  const refundedOrderIds = new Set<string>();
  for (const [orderId, order] of byOrder) {
    const payment = latest.get(`payment:${orderId}`) || latest.get(`status:${orderId}`);
    if (payment?.status === 'refunded') { refundedOrderIds.add(orderId); continue; }
    if (!payment || payment.status !== 'paid') continue;
    const amount = cents(payment.amount);
    const time = paymentTime(payment);
    if (amount == null || amount <= 0 || !Number.isFinite(time)) continue;
    entries.push({ orderId, date: new Date(time), amount: amount / 100, source: isCod(order.payment_method) ? 'cod' : 'online' });
  }
  return { entries, refundedOrderIds };
};

const itemSubtotal = (items: unknown) => {
  const lines = parseJson<unknown>(items, []);
  if (!Array.isArray(lines) || !lines.length) return null;
  let subtotal = 0;
  for (const item of lines) {
    if (!item || typeof item !== 'object') return null;
    const price = cents(item.price);
    const quantity = Number(item.quantity ?? 1);
    if (price == null || !Number.isInteger(quantity) || quantity <= 0) return null;
    subtotal += price * quantity;
  }
  return subtotal;
};

export const buildOrderAnalytics = (
  orders: AnalyticsOrderRow[],
  collections: ReturnType<typeof collectedOrderPayments>,
  revenueEntries: CollectedRevenueEntry[] = collections.entries,
) => {
  const statuses: Record<string, number> = { confirmed: 0, processing: 0, shipped: 0, out_for_delivery: 0, delivered: 0, rto: 0, cancelled: 0 };
  const amounts = { orderValue: 0, productValue: 0, shippingCharges: 0, packagingCharges: 0, codCharges: 0, serviceCharges: 0, discounts: 0, collectedRevenue: 0, onlineCollected: 0, codCollected: 0, codOutstanding: 0 };
  const missingBreakdown = { productValue: 0, shippingCharges: 0, packagingCharges: 0, codCharges: 0 };
  const collectedByOrder = new Map(collections.entries.map((entry) => [entry.orderId, Math.round(entry.amount * 100)]));
  let codOutstandingOrders = 0;
  for (const order of orders) {
    const status = String(order.status || 'unknown').toLowerCase();
    statuses[status] = (statuses[status] || 0) + 1;
    const total = cents(order.total) ?? 0;
    amounts.orderValue += total;
    amounts.discounts += cents(order.coupon_discount) ?? 0;
    const breakdown = {
      productValue: cents(order.items_subtotal) ?? itemSubtotal(order.items),
      shippingCharges: cents(order.shipping_amount),
      packagingCharges: cents(order.packaging_amount),
      codCharges: cents(order.cod_amount) ?? (!isCod(order.payment_method) ? 0 : null),
    };
    for (const key of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
      const amount = breakdown[key];
      if (amount == null) missingBreakdown[key]++;
      else amounts[key] += amount;
    }
    if (isCod(order.payment_method) && !['cancelled', 'rto'].includes(status) && !collections.refundedOrderIds.has(String(order.id))) {
      const due = Math.max(0, total - (collectedByOrder.get(String(order.id)) || 0));
      if (due > 0) { amounts.codOutstanding += due; codOutstandingOrders++; }
    }
  }
  for (const entry of revenueEntries) {
    const amount = Math.round(entry.amount * 100);
    amounts.collectedRevenue += amount;
    amounts[entry.source === 'cod' ? 'codCollected' : 'onlineCollected'] += amount;
  }
  amounts.serviceCharges = amounts.shippingCharges + amounts.packagingCharges + amounts.codCharges;
  return {
    totalOrders: orders.length,
    statuses,
    finances: {
      ...Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, value / 100])) as Record<keyof typeof amounts, number>,
      collectedOrders: revenueEntries.length,
      codOutstandingOrders,
      missingBreakdown,
    },
  };
};
