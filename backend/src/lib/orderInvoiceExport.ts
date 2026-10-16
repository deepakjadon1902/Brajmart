import archiver from 'archiver';
import { Response } from 'express';
import { dbQuery } from './db';
import { merchantOrderWhereSql } from './orderVisibility';
import { buildOrderInvoicePdf, InvoicePayment, orderInvoiceFilename, storedInvoiceItemSku } from './orderInvoice';
import { parseJson } from './dbHelpers';

const text = (value: unknown) => String(value ?? '').trim();
const productIdOf = (item: any) => text(item.productId ?? item.product_id ?? item.product?.id ?? item.product?._id ?? item.id ?? item._id);
const productSlugOf = (item: any) => text(item.slug || item.product?.slug);
const productNameOf = (item: any) => {
  const name = text(item.name || item.product?.name);
  // Early carts appended the selected size to the name instead of storing an ID.
  // Remove only the suffix confirmed by the saved selection, keeping the actual
  // invoice name untouched and requiring a unique exact catalog match below.
  const sizeSuffix = item.selectedSize ? ` (Size: ${text(item.selectedSize)})` : '';
  return sizeSuffix && name.endsWith(sizeSuffix) ? name.slice(0, -sizeSuffix.length) : name;
};

// Older orders did not snapshot SKUs. Resolve only missing SKUs from a stable
// product ID, or a unique exact slug/name when a legacy item has no product ID.
// Never replace a stored SKU, or any historical name, price, variant or total.
export const resolveInvoiceOrderSkus = async (orders: any[]) => {
  const missing = orders.flatMap((order) => parseJson<any[]>(order.items, []).filter((item) => !storedInvoiceItemSku(item)));
  if (!missing.length) return orders;
  const ids = [...new Set(missing.map(productIdOf).filter(Boolean))];
  const legacy = missing.filter((item) => !productIdOf(item));
  const slugs = [...new Set(legacy.map(productSlugOf).filter(Boolean))];
  const names = [...new Set(legacy.filter((item) => !productSlugOf(item)).map(productNameOf).filter(Boolean))];
  const clauses: string[] = [];
  const params: string[] = [];
  for (const [column, values] of [['id', ids], ['slug', slugs], ['name', names]] as const) {
    if (!values.length) continue;
    clauses.push(`${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }
  if (!clauses.length) return orders;
  // Archived products still identify historical order lines.
  const products = await dbQuery<any>(`SELECT id, slug, name, sku FROM products WHERE ${clauses.join(' OR ')}`, params);
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const uniqueMatch = (field: 'slug' | 'name', value: string) => {
    const matches = products.filter((product) => text(product[field]) === value);
    return matches.length === 1 ? matches[0] : undefined;
  };
  return orders.map((order) => ({ ...order, items: parseJson<any[]>(order.items, []).map((item) => {
    if (storedInvoiceItemSku(item)) return item;
    const id = productIdOf(item);
    const slug = productSlugOf(item);
    const product = id ? byId.get(id) : slug ? uniqueMatch('slug', slug) : uniqueMatch('name', productNameOf(item));
    const sku = text(product?.sku);
    return sku ? { ...item, sku } : item;
  }) }));
};

export const getOrderInvoiceManifest = async () => {
  const rows = await dbQuery<{ id: string | number; customer_name: string; shipping_address: unknown }>(`SELECT id, customer_name, shipping_address FROM orders WHERE ${merchantOrderWhereSql('orders')} ORDER BY id ASC`);
  return { invoices: rows.map((row) => ({ orderId: String(row.id), filename: orderInvoiceFilename(row.id, row) })) };
};

export const loadInvoicePayments = async (orderIds: Array<string | number>) => {
  const payments = new Map<string, InvoicePayment>();
  if (!orderIds.length) return payments;
  const placeholders = orderIds.map(() => '?').join(',');
  const [paidRows, statusRows] = await Promise.all([
    dbQuery<any>(`SELECT order_id, transaction_id, method FROM payments
      WHERE order_id IN (${placeholders}) AND status = 'paid' ORDER BY created_at DESC, id DESC`, orderIds),
    dbQuery<any>(`SELECT order_id, payment_id, method FROM payment_status
      WHERE order_id IN (${placeholders}) AND status = 'paid' ORDER BY updated_at DESC, token DESC`, orderIds),
  ]);
  for (const row of [...paidRows, ...statusRows]) {
    const id = String(row.order_id);
    if (!payments.has(id)) payments.set(id, { transactionId: row.transaction_id || row.payment_id || '', method: row.method || '' });
  }
  return payments;
};

// Keyset pagination covers every order without keeping all generated PDFs in RAM.
// The initial upper bound excludes orders created after this export started.
export const streamAllOrderInvoices = async (res: Response) => {
  const snapshot = await dbQuery<any>(`SELECT MAX(id) AS max_id, COUNT(*) AS invoice_count FROM orders WHERE ${merchantOrderWhereSql('orders')}`);
  const maxId = String(snapshot[0]?.max_id || '0');
  if (!Number(snapshot[0]?.invoice_count)) throw Object.assign(new Error('There are no order invoices to download'), { status: 404 });
  const archive = archiver('zip', { zlib: { level: 6 } });
  let archiveError: Error | null = null;
  archive.on('error', (error) => { archiveError = error; res.destroy(error); });
  const cancel = () => { if (!res.writableFinished) archive.abort(); };
  res.on('close', cancel);
  let cursor = '0';
  let started = false;
  try {
    while (!res.destroyed) {
      const rows = await dbQuery<any>(`SELECT * FROM orders
        WHERE id > ? AND id <= ? AND ${merchantOrderWhereSql('orders')}
        ORDER BY id ASC LIMIT 100`, [cursor, maxId]);
      if (!rows.length) break;
      const payments = await loadInvoicePayments(rows.map((row) => row.id));
      for (const row of await resolveInvoiceOrderSkus(rows)) {
        if (res.destroyed || archiveError) return;
        const pdf = await buildOrderInvoicePdf(row, payments.get(String(row.id)));
        if (!started) {
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename="BrajMart-All-Invoices.zip"');
          res.setHeader('Cache-Control', 'private, no-store');
          res.setHeader('X-Invoice-Count', String(snapshot[0].invoice_count));
          archive.pipe(res);
          started = true;
        }
        // Wait for consumption of each PDF before generating the next one.
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => { archive.off('entry', entry); archive.off('error', error); res.off('close', closed); };
          const entry = () => { cleanup(); resolve(); };
          const error = (cause: Error) => { cleanup(); reject(cause); };
          const closed = () => { cleanup(); reject(new Error('Invoice download was cancelled')); };
          archive.once('entry', entry);
          archive.once('error', error);
          res.once('close', closed);
          archive.append(pdf, { name: orderInvoiceFilename(row.id, row) });
        });
      }
      cursor = String(rows[rows.length - 1].id);
    }
    if (!res.destroyed) {
      if (!started) throw Object.assign(new Error('There are no order invoices to download'), { status: 404 });
      await archive.finalize();
    }
  } catch (error) {
    archive.abort();
    throw error;
  } finally {
    res.off('close', cancel);
  }
};
