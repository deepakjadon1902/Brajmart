export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const INDIA_OFFSET_MS = 330 * 60_000;
const indiaCalendar = (date: Date) => new Date(date.getTime() + INDIA_OFFSET_MS);
const fromIndiaCalendar = (date: Date) => new Date(date.getTime() - INDIA_OFFSET_MS);
const dateLabel = (date: Date) => date.toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
});

// Use UTC operations on the shifted India calendar, independent of server TZ.
export const getPeriodStart = (date: Date, period: ReportPeriod) => {
  const local = indiaCalendar(date);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'weekly') local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  if (period === 'monthly') local.setUTCDate(1);
  if (period === 'quarterly') local.setUTCMonth(Math.floor(local.getUTCMonth() / 3) * 3, 1);
  if (period === 'yearly') local.setUTCMonth(0, 1);
  return fromIndiaCalendar(local);
};

export const addPeriod = (start: Date, period: ReportPeriod, amount: number) => {
  const local = indiaCalendar(start);
  if (period === 'daily') local.setUTCDate(local.getUTCDate() + amount);
  if (period === 'weekly') local.setUTCDate(local.getUTCDate() + amount * 7);
  if (period === 'monthly') local.setUTCMonth(local.getUTCMonth() + amount);
  if (period === 'quarterly') local.setUTCMonth(local.getUTCMonth() + amount * 3);
  if (period === 'yearly') local.setUTCFullYear(local.getUTCFullYear() + amount);
  return fromIndiaCalendar(local);
};

export const getBucketKey = (date: Date, period: ReportPeriod) => {
  const local = indiaCalendar(getPeriodStart(date, period));
  if (period === 'daily' || period === 'weekly') return local.toISOString().slice(0, 10);
  if (period === 'monthly') return local.toISOString().slice(0, 7);
  if (period === 'quarterly') return `${local.getUTCFullYear()}-Q${Math.floor(local.getUTCMonth() / 3) + 1}`;
  return String(local.getUTCFullYear());
};

export const getBucketLabel = (start: Date, period: ReportPeriod) => {
  const local = indiaCalendar(start);
  const shortDate = () => start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
  if (period === 'daily') return shortDate();
  if (period === 'weekly') return `Wk ${shortDate()}`;
  if (period === 'monthly') return start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: '2-digit' });
  if (period === 'quarterly') return `Q${Math.floor(local.getUTCMonth() / 3) + 1} ${local.getUTCFullYear()}`;
  return String(local.getUTCFullYear());
};

export const getRangeLabel = (start: Date, end: Date) => {
  const first = dateLabel(start);
  const last = dateLabel(end);
  return first === last ? first : `${first} - ${last}`;
};

export const inDateRange = (value: string | Date, start: Date, end: Date) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
};
