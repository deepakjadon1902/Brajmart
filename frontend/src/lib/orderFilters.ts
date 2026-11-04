export type OrderDatePreset = 'all' | 'today' | 'last7' | 'last30' | 'month' | 'custom';

export const orderDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export const orderDateRange = (preset: OrderDatePreset, now = new Date()) => {
  if (preset === 'all' || preset === 'custom') return { dateFrom: '', dateTo: '' };
  const today = orderDateKey(now);
  const start = new Date(`${today}T00:00:00Z`);
  if (preset === 'last7') start.setUTCDate(start.getUTCDate() - 6);
  if (preset === 'last30') start.setUTCDate(start.getUTCDate() - 29);
  if (preset === 'month') start.setUTCDate(1);
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: today };
};

export const formatOrderDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
