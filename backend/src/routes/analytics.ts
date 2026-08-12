import { Router } from 'express';
import { isDbConnected, dbQuery } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { merchantOrderWhereSql } from '../lib/orderVisibility';
import { toIsoString } from '../lib/dbHelpers';

const router = Router();

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

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

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const startOfQuarter = (date: Date) => new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

const addPeriod = (date: Date, period: ReportPeriod, amount: number) => {
  const d = new Date(date);
  if (period === 'daily') d.setDate(d.getDate() + amount);
  if (period === 'weekly') d.setDate(d.getDate() + amount * 7);
  if (period === 'monthly') d.setMonth(d.getMonth() + amount);
  if (period === 'quarterly') d.setMonth(d.getMonth() + amount * 3);
  if (period === 'yearly') d.setFullYear(d.getFullYear() + amount);
  return d;
};

const getPeriodStart = (date: Date, period: ReportPeriod) => {
  if (period === 'daily') return startOfDay(date);
  if (period === 'weekly') return startOfWeek(date);
  if (period === 'monthly') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (period === 'quarterly') return startOfQuarter(date);
  return new Date(date.getFullYear(), 0, 1);
};

const getPeriodEnd = (start: Date, period: ReportPeriod) => new Date(addPeriod(start, period, 1).getTime() - 1);

const getBucketKey = (date: Date, period: ReportPeriod) => {
  const start = getPeriodStart(date, period);
  if (period === 'daily' || period === 'weekly') return start.toISOString().slice(0, 10);
  if (period === 'monthly') return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'quarterly') return `${start.getFullYear()}-Q${Math.floor(start.getMonth() / 3) + 1}`;
  return String(start.getFullYear());
};

const getBucketLabel = (start: Date, period: ReportPeriod) => {
  if (period === 'daily') return start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  if (period === 'weekly') return `Wk ${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
  if (period === 'monthly') return start.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  if (period === 'quarterly') return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
  return String(start.getFullYear());
};

const getRangeLabel = (start: Date, end: Date, period: ReportPeriod) => {
  if (period === 'yearly') return String(start.getFullYear());
  if (period === 'monthly') return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

const buildBuckets = (period: ReportPeriod, entries: RevenueEntry[]) => {
  const currentStart = getPeriodStart(new Date(), period);
  const buckets: Bucket[] = Array.from({ length: periodConfig[period].points }, (_, index) => {
    const start = addPeriod(currentStart, period, index - periodConfig[period].points + 1);
    const end = getPeriodEnd(start, period);
    return {
      key: getBucketKey(start, period),
      label: getBucketLabel(start, period),
      rangeLabel: getRangeLabel(start, end, period),
      start,
      end,
      revenue: 0,
      orders: 0,
    };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  entries.forEach((entry) => {
    const bucket = byKey.get(getBucketKey(entry.date, period));
    if (!bucket) return;
    bucket.revenue += entry.amount;
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
    const [revenueRows, orderRows, categoryRows] = await Promise.all([
      dbQuery<any>(
        `SELECT source, created_at, amount FROM (
           SELECT 'online' AS source, COALESCE(p.created_at, o.created_at) AS created_at, p.amount
           FROM payments p
           LEFT JOIN orders o ON o.id = p.order_id
           WHERE p.status = 'paid'
           UNION ALL
           SELECT 'online' AS source, COALESCE(ps.created_at, o.created_at) AS created_at, COALESCE(ps.amount, o.total, 0) AS amount
           FROM payment_status ps
           LEFT JOIN orders o ON o.id = ps.order_id
           WHERE ps.status = 'paid'
             AND NOT EXISTS (
               SELECT 1
               FROM payments p
               WHERE p.order_id = ps.order_id
                  OR p.transaction_id = ps.token
                  OR (ps.payment_id IS NOT NULL AND p.transaction_id = ps.payment_id)
               LIMIT 1
             )
           UNION ALL
           SELECT 'cod' AS source, o.created_at, o.total AS amount
           FROM orders o
           WHERE LOWER(o.payment_method) IN ('cod', 'cash on delivery')
         ) revenue
         WHERE created_at IS NOT NULL AND amount > 0
         ORDER BY created_at ASC`
      ),
      dbQuery<any>(
        `SELECT id, total, status, payment_method, created_at
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

    const entries: RevenueEntry[] = revenueRows
      .map((row) => ({
        date: new Date(row.created_at),
        amount: Number(row.amount || 0),
        source: String(row.source || '') === 'cod' ? 'cod' as const : 'online' as const,
      }))
      .filter((entry) => entry.amount > 0 && !Number.isNaN(entry.date.getTime()));

    const buckets = buildBuckets(period, entries);
    const currentBucket = buckets[buckets.length - 1];
    const previousBucket = buckets[buckets.length - 2];
    const currentOrders = orderRows.filter((row) => {
      const date = new Date(row.created_at);
      return currentBucket && !Number.isNaN(date.getTime()) && date >= currentBucket.start && date <= currentBucket.end;
    });
    const currentEntries = entries.filter((entry) => entry.date >= currentBucket.start && entry.date <= currentBucket.end);

    const periodRevenue = currentBucket.revenue;
    const previousRevenue = previousBucket?.revenue || 0;
    const revenueChange = previousRevenue > 0 ? ((periodRevenue - previousRevenue) / previousRevenue) * 100 : periodRevenue > 0 ? 100 : 0;
    const deliveredOrders = currentOrders.filter((row) => String(row.status || '') === 'delivered').length;
    const cancelledOrders = currentOrders.filter((row) => String(row.status || '') === 'cancelled').length;
    const totalPeriodOrders = currentOrders.length;
    const totalRevenue = entries.reduce((sum, entry) => sum + entry.amount, 0);

    res
      .setHeader('Cache-Control', 'no-store, max-age=0')
      .json({
        period,
        generatedAt: new Date().toISOString(),
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
