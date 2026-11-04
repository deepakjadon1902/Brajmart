type OrderFilterQuery = {
  search?: unknown;
  customer?: unknown;
  status?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
};

const statuses = new Set(['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'rto', 'cancelled']);
const invalid = (message: string): never => { throw Object.assign(new Error(message), { status: 400 }); };
const value = (input: unknown, label: string) => {
  if (input == null) return '';
  if (typeof input !== 'string') return invalid(`Invalid ${label} filter`);
  return input.trim();
};
const dateValue = (input: unknown, label: string) => {
  const date = value(input, label);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1000
    || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
    return invalid(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return date;
};
const literalLike = (input: string) => `%${input.toLowerCase().replace(/[!%_]/g, '!$&')}%`;

// The table, manifest and streamed ZIP use identical predicates. Pagination is
// intentionally excluded so exports include every matching merchant order.
export const adminOrderFilterSql = (query: OrderFilterQuery = {}) => {
  const clauses: string[] = [];
  const params: Array<string | Date> = [];
  const search = value(query.search, 'search');
  const customer = value(query.customer, 'customer');
  const status = value(query.status, 'status');
  const from = dateValue(query.dateFrom, 'From date');
  const to = dateValue(query.dateTo, 'To date');
  if (from && to && from > to) return invalid('From date must be on or before To date');

  if (search) {
    const columns = ["CAST(id AS CHAR)", "COALESCE(customer_name, '')", "COALESCE(customer_email, '')",
      "COALESCE(tracking_id, '')", "COALESCE(payment_method, '')", 'CAST(shipping_address AS CHAR)',
      'CAST(billing_address AS CHAR)', 'CAST(items AS CHAR)'];
    clauses.push(`(${columns.map((column) => `LOWER(${column}) LIKE ? ESCAPE '!'`).join(' OR ')})`);
    params.push(...columns.map(() => literalLike(search)));
  }
  if (customer) {
    clauses.push(`LOWER(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(shipping_address), shipping_address, JSON_OBJECT()), '$.fullName')), ''), customer_name, '')) LIKE ? ESCAPE '!'`);
    params.push(literalLike(customer));
  }
  if (status && status !== 'all') {
    const selected = [...new Set(status.split(',').map((entry) => entry.trim()))];
    if (selected.some((entry) => !statuses.has(entry))) return invalid('Invalid order status filter');
    clauses.push(`status IN (${selected.map(() => '?').join(',')})`);
    params.push(...selected);
  }
  // mysql2 uses UTC. Interpret both selected calendar dates in India and use
  // an exclusive next-midnight bound so the entire final day is included.
  if (from) {
    clauses.push('created_at >= ?');
    params.push(new Date(`${from}T00:00:00+05:30`));
  }
  if (to) {
    clauses.push('created_at < ?');
    params.push(new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000));
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
};
