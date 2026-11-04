import { Router } from 'express';
import { isDbConnected, dbQuery } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import { buildOrderAnalytics, collectedOrderPayments, type AnalyticsOrderRow, type AnalyticsPaymentRow } from '../lib/analyticsSummary';
import { addPeriod, getPeriodStart, getBucketKey, getBucketLabel, getRangeLabel, inDateRange, type ReportPeriod } from '../lib/analyticsPeriods';

const router = Router();

type RevenueEntry = {
  date: Date;
  amount: number;
  source: 'online' | 'cod';
};

type Bucket = {
  key: string;
  label: string;
  rangeLabel: string;
  start: Date;
  end: Date;
  revenue: number;
  orders: number;
};

const reportPeriods = new Set<ReportPeriod>(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
const periodConfig: Record<ReportPeriod, { points: number; title: string }> = {
  daily: { points: 14, title: 'Last 14 Days' },
  weekly: { points: 12, title: 'Last 12 Weeks' },
  monthly: { points: 12, title: 'Last 12 Months' },
  quarterly: { points: 8, title: 'Last 8 Quarters' },
  yearly: { points: 5, title: 'Last 5 Years' },
};

const asPeriod = (value: unknown): ReportPeriod => {
  const period = String(value || '').toLowerCase() as ReportPeriod;
  return reportPeriods.has(period) ? period : 'daily';
};

const buildBuckets = (period: ReportPeriod, entries: RevenueEntry[], now: Date) => {
  const currentStart = getPeriodStart(now, period);
  const buckets: Bucket[] = Array.from({ length: periodConfig[period].points }, (_, index) => {
    const start = addPeriod(currentStart, period, index - periodConfig[period].points + 1);
    const end = new Date(Math.min(addPeriod(start, period, 1).getTime() - 1, now.getTime()));
    return {
      key: getBucketKey(start, period),
      label: getBucketLabel(start, period),
      rangeLabel: getRangeLabel(start, end),
      start,
      end,
      revenue: 0,
      orders: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  entries.forEach((entry) => {
    const bucket = byKey.get(getBucketKey(entry.date, period));
    if (!bucket || !inDateRange(entry.date, bucket.start, bucket.end)) return;
    bucket.revenue = Math.round(bucket.revenue * 100 + entry.amount * 100) / 100;
    bucket.orders += 1;
  });

  return buckets;
};

const countBy = <T>(items: T[], getKey: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

router.get('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const period = asPeriod(req.query.period);
    const now = new Date();
    const [paymentRows, orderRows, categoryRows] = await Promise.all([
      dbQuery<AnalyticsPaymentRow>(
        `SELECT 'payment' AS origin, p.id AS record_id, p.order_id, p.amount, p.status, p.created_at, p.updated_at
         FROM payments p
         WHERE p.status IN ('paid', 'refunded') AND p.order_id IS NOT NULL
         UNION ALL
         SELECT 'status' AS origin, ps.token AS record_id, ps.order_id, COALESCE(ps.amount, o.total) AS amount, ps.status, ps.created_at, ps.updated_at
         FROM payment_status ps
         INNER JOIN orders o ON o.id = ps.order_id
         WHERE ps.status IN ('paid', 'refunded')`
      ),
      dbQuery<AnalyticsOrderRow>(
        `SELECT id, total, status, payment_method, created_at, items, items_subtotal,
                shipping_amount, packaging_amount, cod_amount, coupon_discount
         FROM orders o
         WHERE ${merchantOrderWhereSql('o')}
         ORDER BY created_at DESC`
      ),
      dbQuery<any>(
        `SELECT COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS category, COUNT(*) AS count
         FROM products
         GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized')
         ORDER BY count DESC, category ASC`
      ),
    ]);

    const ordersToDate = orderRows.filter((row) => inDateRange(row.created_at, new Date(0), now));
    const collections = collectedOrderPayments(ordersToDate, paymentRows, now);
    const entries = collections.entries;
    const allTime = buildOrderAnalytics(ordersToDate, collections);

    const buckets = buildBuckets(period, entries, now);
    const currentBucket = buckets[buckets.length - 1];
    const previousBucket = buckets[buckets.length - 2];
    const currentOrders = ordersToDate.filter((row) => inDateRange(row.created_at, currentBucket.start, now));
    const currentEntries = entries.filter((entry) => inDateRange(entry.date, currentBucket.start, now));
    const periodSummary = buildOrderAnalytics(currentOrders, collections, currentEntries);

    const periodRevenue = currentBucket.revenue;
    const previousRevenue = previousBucket?.revenue || 0;
    const revenueChange = previousRevenue > 0 ? ((periodRevenue - previousRevenue) / previousRevenue) * 100 : periodRevenue > 0 ? 100 : 0;
    const deliveredOrders = currentOrders.filter((row) => String(row.status || '') === 'delivered').length;
    const cancelledOrders = currentOrders.filter((row) => String(row.status || '') === 'cancelled').length;
    const totalPeriodOrders = currentOrders.length;
    const totalRevenue = allTime.finances.collectedRevenue;

    res
      .setHeader('Cache-Control', 'no-store, max-age=0')
      .json({
        period,
        generatedAt: now.toISOString(),
        allTime,
        periodSummary,
        range: {
          label: currentBucket.rangeLabel,
          start: currentBucket.start.toISOString(),
          end: currentBucket.end.toISOString(),
        },
        totals: {
          periodRevenue,
          previousRevenue,
          revenueChange,
          periodOrders: totalPeriodOrders,
          deliveredOrders,
          cancelledOrders,
          averageOrderValue: totalPeriodOrders ? periodRevenue / totalPeriodOrders : 0,
          totalRevenue,
          paidSalesCount: entries.length,
          onlineRevenue: currentEntries.filter((entry) => entry.source === 'online').reduce((sum, entry) => sum + entry.amount, 0),
          codRevenue: currentEntries.filter((entry) => entry.source === 'cod').reduce((sum, entry) => sum + entry.amount, 0),
          completionRate: totalPeriodOrders ? (deliveredOrders / totalPeriodOrders) * 100 : 0,
        },
        buckets: buckets.map((bucket) => ({
          key: bucket.key,
          label: bucket.label,
          rangeLabel: bucket.rangeLabel,
          start: bucket.start.toISOString(),
          end: bucket.end.toISOString(),
          revenue: bucket.revenue,
          orders: bucket.orders,
        })),
        breakdowns: {
          categories: categoryRows.map((row) => ({
            category: String(row.category || 'Uncategorized'),
            count: Number(row.count || 0),
          })),
          statuses: countBy(currentOrders, (row) => String(row.status || 'unknown')),
          payments: countBy(currentOrders, (row) => String(row.payment_method || 'Unknown')),
        },
      });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load analytics' });
  }
});

export default router;
