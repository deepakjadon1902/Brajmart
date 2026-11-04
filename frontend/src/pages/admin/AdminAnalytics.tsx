import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, BarChart3, CalendarDays, IndianRupee, Package, PieChart, RefreshCw, ShoppingBag, TrendingUp, Truck, CheckCircle2, Clock3, PackageCheck, PackageX, RotateCcw } from 'lucide-react';
import { fetchAnalyticsReport, type AnalyticsOrderSummary, type AnalyticsPeriod, type AnalyticsReport } from '@/lib/api';
import { toast } from 'sonner';

const reportPeriods: { key: AnalyticsPeriod; label: string; shortLabel: string }[] = [
  { key: 'daily', label: 'Daily', shortLabel: 'Day' },
  { key: 'weekly', label: 'Weekly', shortLabel: 'Week' },
  { key: 'monthly', label: 'Monthly', shortLabel: 'Month' },
  { key: 'quarterly', label: 'Quarterly', shortLabel: 'Quarter' },
  { key: 'yearly', label: 'Yearly', shortLabel: 'Year' },
];

const periodTitles: Record<AnalyticsPeriod, string> = {
  daily: 'Last 14 Days',
  weekly: 'Last 12 Weeks',
  monthly: 'Last 12 Months',
  quarterly: 'Last 8 Quarters',
  yearly: 'Last 5 Years',
};

const errorMessage = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;
const currency = (value: number) => `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatCount = (value: number) => Number(value || 0).toLocaleString('en-IN');
const AUTO_REFRESH_MS = 15_000;
const orderStatusCards = [
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, barClass: 'admin-chart-fill-confirmed' },
  { key: 'processing', label: 'Processing', icon: Clock3, barClass: 'admin-chart-fill-processing' },
  { key: 'shipped', label: 'Shipped', icon: Truck, barClass: 'admin-chart-fill-shipped' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Package, barClass: 'admin-chart-fill-out-for-delivery' },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck, barClass: 'admin-chart-fill-delivered' },
  { key: 'rto', label: 'RTO', icon: RotateCcw, barClass: 'admin-chart-fill-neutral' },
  { key: 'cancelled', label: 'Cancelled', icon: PackageX, barClass: 'admin-chart-fill-cancelled' },
];

const AdminAnalytics = () => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [lastReport, setReport] = useState<AnalyticsReport | null>(null);
  const report = lastReport?.period === period ? lastReport : null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const latestRequest = useRef(0);
  const requestInFlight = useRef(false);

  const loadReport = useCallback(async (nextPeriod: AnalyticsPeriod, quiet = false) => {
    if (quiet && requestInFlight.current) return;
    requestInFlight.current = true;
    const request = ++latestRequest.current;
    try {
      setLoading(true);
      const data = await fetchAnalyticsReport(nextPeriod);
      if (request === latestRequest.current) {
        setReport(data);
        setLoadError('');
      }
    } catch (err: unknown) {
      if (request === latestRequest.current) {
        const message = errorMessage(err, 'Failed to load analytics');
        setLoadError(message);
        if (!quiet) toast.error(message);
      }
    } finally {
      if (request === latestRequest.current) {
        requestInFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadReport(period);
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void loadReport(period, true);
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      latestRequest.current++;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadReport, period]);

  const maxRevenue = useMemo(() => Math.max(...(report?.buckets || []).map((bucket) => bucket.revenue), 1), [report]);
  const totals = report?.totals;
  const categoryTotal = (report?.breakdowns.categories || []).reduce((sum, item) => sum + item.count, 0);
  const selectedPeriod = reportPeriods.find((item) => item.key === period);

  const metricCards = [
    { label: 'Period Revenue', value: currency(totals?.periodRevenue || 0), detail: report?.range.label || 'Current period', icon: IndianRupee, color: 'from-emerald-500 to-teal-600' },
    { label: 'Period Orders', value: formatCount(totals?.periodOrders || 0), detail: `${formatCount(totals?.deliveredOrders || 0)} delivered`, icon: ShoppingBag, color: 'from-blue-500 to-indigo-600' },
    { label: 'Avg Order Value', value: currency(totals?.averageOrderValue || 0), detail: `${(totals?.revenueChange || 0) >= 0 ? '+' : ''}${(totals?.revenueChange || 0).toFixed(1)}% vs previous`, icon: TrendingUp, color: 'from-amber-500 to-orange-600' },
    { label: 'All-Time Collected Revenue', value: currency(totals?.totalRevenue || 0), detail: `${formatCount(totals?.paidSalesCount || 0)} paid orders`, icon: CalendarDays, color: 'from-purple-500 to-pink-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-slate-400">
            {report?.generatedAt ? `Last updated ${new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.` : 'Loading reports from the database...'} Auto-refreshes every 15 seconds.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => loadReport(period)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1 sm:flex">
            {reportPeriods.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                aria-pressed={period === item.key}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  period === item.key ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadError && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{loadError}. {report ? 'Showing the last successful report. ' : ''}Retrying automatically.</div>}

      <PeriodOverview summary={report?.periodSummary} periodLabel={selectedPeriod?.label || 'Daily'} rangeLabel={report?.range.label} loading={!report && loading} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${metric.color}`}>
                <metric.icon size={20} className="text-white" />
              </div>
              <span className="text-right text-xs text-slate-400">{metric.detail}</span>
            </div>
            <p className="text-2xl font-bold text-white">{loading && !report ? '...' : metric.value}</p>
            <p className="text-sm text-slate-400">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">{selectedPeriod?.label} Revenue Report</h2>
          </div>
          <span className="text-sm text-slate-400">{periodTitles[period]}</span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatPanel label="Online Revenue" value={currency(totals?.onlineRevenue || 0)} />
          <StatPanel label="COD Revenue" value={currency(totals?.codRevenue || 0)} />
          <StatPanel label="Cancelled Orders" value={formatCount(totals?.cancelledOrders || 0)} />
        </div>

        <div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">
          {(report?.buckets || []).map((bucket) => (
            <div key={bucket.key} className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="admin-chart-revenue-bar w-full rounded-t-lg shadow-sm"
                  title={`${bucket.rangeLabel}: ${currency(bucket.revenue)} from ${bucket.orders} sales`}
                  style={{ height: bucket.revenue ? `${Math.max((bucket.revenue / maxRevenue) * 100, 8)}%` : '4%' }}
                />
              </div>
              <span className="w-full truncate text-center text-xs text-slate-400">{bucket.label}</span>
            </div>
          ))}
          {!report && <div className="flex w-full items-center justify-center text-sm text-slate-400">Loading analytics...</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BreakdownCard icon={PieChart} iconClass="text-blue-400" title="Products by Category">
          {report?.breakdowns.categories.length ? report.breakdowns.categories.map((item) => (
            <ProgressRow
              key={item.category}
              label={item.category}
              value={`${item.count}`}
              width={categoryTotal ? (item.count / categoryTotal) * 100 : 0}
              barClass="admin-chart-fill-category"
            />
          )) : <EmptyState label="No products found" />}
        </BreakdownCard>

        <BreakdownCard icon={BarChart3} iconClass="text-emerald-400" title="Order Status — Selected Period">
          {report && Object.entries(report.breakdowns.statuses).length ? Object.entries(report.breakdowns.statuses).map(([status, count]) => {
            const colors: Record<string, string> = {
              confirmed: 'admin-chart-fill-confirmed',
              processing: 'admin-chart-fill-processing',
              shipped: 'admin-chart-fill-shipped',
              delivered: 'admin-chart-fill-delivered',
              cancelled: 'admin-chart-fill-cancelled',
              out_for_delivery: 'admin-chart-fill-out-for-delivery',
            };
            return (
              <ProgressRow
                key={status}
                label={status.replace(/_/g, ' ')}
                value={`${count}`}
                width={totals?.periodOrders ? (count / totals.periodOrders) * 100 : 0}
                barClass={colors[status] || 'admin-chart-fill-neutral'}
              />
            );
          }) : <EmptyState label={`No ${selectedPeriod?.shortLabel.toLowerCase()} orders`} />}
        </BreakdownCard>

        <BreakdownCard icon={Activity} iconClass="text-purple-400" title="Payment Methods">
          {report && Object.entries(report.breakdowns.payments).length ? Object.entries(report.breakdowns.payments).map(([method, count]) => (
            <div key={method} className="flex items-center justify-between rounded-xl bg-slate-800/50 p-3">
              <span className="font-medium text-white">{method}</span>
              <span className="font-bold text-amber-400">{count} orders</span>
            </div>
          )) : <EmptyState label="No payment data for this period" />}
        </BreakdownCard>

        <BreakdownCard icon={Package} iconClass="text-amber-400" title="Report Summary">
          <SummaryRow label="Selected Period" value={selectedPeriod?.label || 'Daily'} />
          <SummaryRow label="Current Range" value={report?.range.label || '-'} />
          <SummaryRow label="Revenue Growth" value={`${(totals?.revenueChange || 0) >= 0 ? '+' : ''}${(totals?.revenueChange || 0).toFixed(1)}%`} valueClass={(totals?.revenueChange || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          <SummaryRow label="Completion Rate" value={`${(totals?.completionRate || 0).toFixed(1)}%`} />
        </BreakdownCard>
      </div>
    </div>
  );
};

const PeriodOverview = ({ summary, periodLabel, rangeLabel, loading }: { summary?: AnalyticsOrderSummary; periodLabel: string; rangeLabel?: string; loading: boolean }) => {
  const finances = summary?.finances;
  const total = summary?.totalOrders || 0;
  const statuses = [
    ...orderStatusCards,
    ...Object.keys(summary?.statuses || {}).filter((key) => !orderStatusCards.some((card) => card.key === key)).map((key) => ({
      key, label: key.replace(/_/g, ' '), icon: ShoppingBag, barClass: 'admin-chart-fill-neutral',
    })),
  ];
  const chargeCards = [
    { key: 'productValue' as const, label: 'Products value', value: finances?.productValue },
    { key: 'shippingCharges' as const, label: 'Shipping charges', value: finances?.shippingCharges },
    { key: 'packagingCharges' as const, label: 'Packaging charges', value: finances?.packagingCharges },
    { key: 'codCharges' as const, label: 'COD fees', value: finances?.codCharges },
  ];
  const missing = finances && Object.values(finances.missingBreakdown).some((count) => count > 0);
  return (
    <>
      <section aria-labelledby="period-order-status-title" className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="period-order-status-title" className="text-lg font-semibold text-white">{periodLabel} Order Status</h2>
            <p className="mt-1 text-sm text-slate-400">Current status of orders placed in the selected period, up to the latest refresh.</p>
          </div>
          <span className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300">{rangeLabel ? `${rangeLabel} · IST` : 'Loading date range...'}</span>
        </div>
        {!summary && <p role="status" className="text-sm text-slate-400">{loading ? 'Loading selected period...' : 'Period totals are unavailable. Please refresh or try again.'}</p>}
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div role="group" aria-label="Total orders" className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <ShoppingBag size={19} className="mb-3 text-amber-400" />
            <dt className="text-sm text-slate-400">Total orders</dt>
            <dd className="mt-1 text-2xl font-bold text-white">{summary ? formatCount(total) : '—'}</dd>
          </div>
          {statuses.map(({ key, label, icon: Icon, barClass }) => {
            const count = summary?.statuses[key] || 0;
            return (
              <div key={key} role="group" aria-label={label} className="rounded-xl border border-slate-700 p-4">
                <Icon size={19} className="mb-3 text-slate-400" />
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-white">{summary ? formatCount(count) : '—'}</dd>
                <div className="admin-chart-progress-track mt-3 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                  <div className={`admin-chart-progress-fill h-full rounded-full ${barClass}`} style={{ width: `${total ? count / total * 100 : 0}%` }} />
                </div>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="period-finances-title" className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="period-finances-title" className="text-lg font-semibold text-white">{periodLabel} Order Charges &amp; Revenue</h2>
            <p className="mt-1 text-sm text-slate-400">{rangeLabel ? `${rangeLabel} · IST. ` : ''}Order values and charges use order dates. Collections use payment dates.</p>
          </div>
          <IndianRupee size={21} className="text-amber-400" />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinancialMetric label="Total order value" value={finances?.orderValue} detail="Orders placed in this period, including cancelled and RTO" />
          <FinancialMetric label="Collected revenue" value={finances?.collectedRevenue} detail={finances ? `${formatCount(finances.collectedOrders)} orders with payments recorded in this period` : 'Payments recorded in this period'} />
          <FinancialMetric label="Online collected" value={finances?.onlineCollected} detail="Online payments recorded in this period" />
          <FinancialMetric label="COD collected" value={finances?.codCollected} detail="COD payments marked collected in this period" />
        </dl>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {chargeCards.map(({ key, label, value }) => (
            <FinancialMetric key={key} label={label} value={value} detail={finances ? `${formatCount(total - finances.missingBreakdown[key])} of ${formatCount(total)} orders recorded` : 'Saved order breakdown'} />
          ))}
        </dl>
        <div className="grid gap-3 md:grid-cols-3">
          <dl><FinancialMetric label="COD awaiting collection" value={finances?.codOutstanding} detail={finances ? `${formatCount(finances.codOutstandingOrders)} orders placed in this period · excludes cancelled, RTO and refunds` : 'Uncollected COD orders placed in this period'} /></dl>
          <dl><FinancialMetric label="Order discounts" value={finances?.discounts} detail="Discounts saved on orders" /></dl>
          <dl><FinancialMetric label="Total shipping, packaging & COD" value={finances?.serviceCharges} detail="Sum of the recorded charges above" /></dl>
        </div>
        <p className="text-xs text-slate-400">Charges are the amounts saved on customer orders placed in this period, including cancelled and RTO orders. Collected revenue uses payments recorded in this period, including payments for earlier orders, and excludes unpaid COD and payments marked as refunded.</p>
        {missing && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300">Some older orders have no saved price breakdown. These subtotals include recorded amounts only; missing amounts are not estimated using today’s prices.</p>}
      </section>
    </>
  );
};

const FinancialMetric = ({ label, value, detail }: { label: string; value?: number; detail: string }) => (
  <div role="group" aria-label={label} className="h-full rounded-xl bg-slate-800/50 p-4">
    <dt className="text-sm text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-xl font-bold text-white">{value == null ? '—' : currency(value)}</dd>
    <p className="mt-2 text-xs text-slate-400">{detail}</p>
  </div>
);

const StatPanel = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-slate-800/50 p-4">
    <p className="text-sm text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-bold text-white">{value}</p>
  </div>
);

const BreakdownCard = ({
  title,
  icon: Icon,
  iconClass,
  children,
}: {
  title: string;
  icon: typeof PieChart;
  iconClass: string;
  children: ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <Icon size={18} className={iconClass} />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const ProgressRow = ({ label, value, width, barClass }: { label: string; value: string; width: number; barClass: string }) => (
  <div>
    <div className="mb-1 flex justify-between gap-3 text-sm">
      <span className="capitalize text-slate-300">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
    <div className="admin-chart-progress-track h-2 overflow-hidden rounded-full">
      <div className={`admin-chart-progress-fill h-full rounded-full ${barClass}`} style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }} />
    </div>
  </div>
);

const SummaryRow = ({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-slate-400">{label}</span>
    <span className={`text-right text-lg font-bold ${valueClass}`}>{value}</span>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-xl bg-slate-800/50 p-4 text-sm text-slate-400">{label}</div>
);

export default AdminAnalytics;
