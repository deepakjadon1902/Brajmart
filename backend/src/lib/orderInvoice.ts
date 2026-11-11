import PDFDocument from 'pdfkit';
import path from 'node:path';
import { parseJson } from './dbHelpers';
import { allocatePaise, invoiceStateCode } from './productTax';

const ASSETS = path.resolve(__dirname, '../../assets/invoice');
const clean = (value: unknown) => String(value ?? '').trim();
const fail = (message: string): never => { throw Object.assign(new Error(message), { status: 422 }); };
const cents = (value: unknown, label: string) => {
  if (value == null || value === '') return fail(`Cannot generate invoice: missing ${label}`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fail(`Cannot generate invoice: invalid ${label}`);
  return Math.round(number * 100);
};
const money = (value: number) => `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const addressPresent = (address: any) => ['fullName', 'street', 'address', 'addressLine1', 'city', 'state', 'pincode'].some((key) => clean(address?.[key]));
// Compare the recipient and address, allowing legacy field names and formatting.
// Contact details and saved-address metadata do not make a delivery address different.
const invoiceAddressKey = (address: any, customerName: string) => JSON.stringify([
  address.fullName || address.name || customerName,
  address.street || address.address || address.addressLine1,
  address.addressLine2 || address.line2,
  address.city,
  address.pincode || address.postalCode,
  address.state,
].map((value) => clean(value).normalize('NFC').replace(/\s+/gu, ' ').toLowerCase()));
const alternateNumber = (address: any) => [address.alternateMobile, address.alternatePhone, address.altPhone, address.altMobile].map(clean).find(Boolean) || '';

export type InvoicePayment = { transactionId?: string; method?: string };
export const storedInvoiceItemSku = (item: any) => [item.sku, item.selectedSku, item.product?.sku].map(clean).find(Boolean) || '';

export const buildOrderInvoiceModel = (row: any, payment: InvoicePayment = {}) => {
  const orderId = clean(row.id);
  if (!/^\d+$/.test(orderId)) return fail('Cannot generate invoice: invalid order number');
  const rawItems = parseJson<any[]>(row.items, []);
  if (!Array.isArray(rawItems) || !rawItems.length) return fail(`Order ${orderId} has no invoice items`);
  const baseItems = rawItems.map((item, index) => {
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity <= 0) return fail(`Order ${orderId}: invalid quantity for item ${index + 1}`);
    const price = cents(item.price, `price for item ${index + 1}`);
    const selections = { ...(item.selections || {}), ...(item.selectedAttributes || {}) };
    if (item.selectedSize && !selections.Size && !selections.size) selections.Size = item.selectedSize;
    if (item.selectedPieces && !selections.Pieces && !selections.pieces) selections.Pieces = item.selectedPieces;
    const variants = Object.entries(selections).filter(([, value]) => clean(value)).map(([key, value]) => `${key}: ${clean(value)}`);
    const gstRate = item.gstRate == null || item.gstRate === '' ? null : Number(item.gstRate);
    if (gstRate !== null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100 || Math.abs(gstRate * 100 - Math.round(gstRate * 100)) > 0.000001)) return fail(`Order ${orderId}: invalid GST rate for item ${index + 1}`);
    return {
      name: clean(item.name || item.product?.name) || 'Item',
      variants: variants.join(', '),
      sku: storedInvoiceItemSku(item),
      hsnCode: clean(item.hsnCode), unit: clean(item.unit), gstRate,
      quantity, price,
    };
  });
  const shipping = parseJson<any>(row.shipping_address, {}) || {};
  const storedBilling = parseJson<any>(row.billing_address, {}) || {};
  const billing = addressPresent(storedBilling) ? storedBilling : shipping;
  const subtotal = baseItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = cents(row.total, 'order total');
  const coupon = parseJson<any>(row.coupon_details, {}) || {};
  const discount = cents(row.coupon_discount ?? coupon.discountAmount ?? 0, 'discount');
  const productDiscount = cents(coupon.productDiscount ?? Math.min(subtotal / 100, Math.max(0, discount / 100 - Number(coupon.freeShipping || 0) - Number(coupon.freePackaging || 0))), 'product discount');
  if (productDiscount > subtotal || productDiscount > discount) return fail(`Order ${orderId}: product discount exceeds the recorded amounts`);
  let itemDiscounts: number[];
  if (coupon.itemDiscounts != null) {
    if (!Array.isArray(coupon.itemDiscounts) || coupon.itemDiscounts.length !== baseItems.length || coupon.itemDiscounts.some((amount: any, index: number) => !Number.isSafeInteger(amount) || amount < 0 || amount > baseItems[index].price * baseItems[index].quantity) || coupon.itemDiscounts.reduce((sum: number, amount: number) => sum + amount, 0) !== productDiscount) return fail(`Order ${orderId}: invalid saved item discounts`);
    itemDiscounts = coupon.itemDiscounts;
  } else itemDiscounts = allocatePaise(productDiscount, baseItems.map((item) => item.price * item.quantity));
  const placeOfSupply = clean(shipping.state || billing.state);
  const supplyStateCode = invoiceStateCode(placeOfSupply);
  const taxMode = supplyStateCode === '09' ? 'intra-state' : supplyStateCode ? 'inter-state' : 'unknown';
  if (taxMode === 'unknown' && baseItems.some((item) => item.gstRate !== null && item.gstRate > 0)) return fail(`Order ${orderId}: a recognised delivery state is required to calculate IGST or CGST/SGST`);
  const items = baseItems.map((item, index) => {
    const lineTotal = item.price * item.quantity;
    const netTotal = lineTotal - itemDiscounts[index];
    const taxable = item.gstRate === null ? null : Math.round(netTotal * 10000 / (10000 + Math.round(item.gstRate * 100)));
    const tax = taxable === null ? null : netTotal - taxable;
    // Assign any odd paise to SGST so the two components reconcile exactly.
    const cgst = tax === null ? null : taxMode === 'intra-state' ? Math.floor(tax / 2) : 0;
    return { ...item, lineTotal, discount: itemDiscounts[index], netTotal, taxable, tax,
      igst: tax === null ? null : taxMode === 'inter-state' ? tax : 0,
      cgst, sgst: tax === null ? null : taxMode === 'intra-state' ? tax - (cgst || 0) : 0 };
  });
  const taxComplete = items.every((item) => item.gstRate !== null);
  const taxSummary = taxComplete ? [
    { label: 'Taxable Value (products)', amount: items.reduce((sum, item) => sum + (item.taxable || 0), 0) },
    ...(taxMode === 'intra-state' ? [
      { label: 'CGST (included)', amount: items.reduce((sum, item) => sum + (item.cgst || 0), 0) },
      { label: 'SGST (included)', amount: items.reduce((sum, item) => sum + (item.sgst || 0), 0) },
    ] : [{ label: 'IGST (included)', amount: items.reduce((sum, item) => sum + (item.igst || 0), 0) }]),
  ] : [];
  const totals: { label: string; amount: number }[] = [{ label: 'Subtotal', amount: subtotal }];
  const hasBreakdown = ['shipping_amount', 'packaging_amount', 'cod_amount'].some((key) => row[key] != null);
  if (hasBreakdown) {
    totals.push({ label: 'Shipping', amount: cents(row.shipping_amount ?? 0, 'shipping') });
    totals.push({ label: 'Packaging Cost', amount: cents(row.packaging_amount ?? 0, 'packaging') });
    if (Number(row.cod_amount) > 0) totals.push({ label: 'COD Fee', amount: cents(row.cod_amount, 'COD fee') });
  } else {
    const combinedCharges = total - subtotal + discount;
    if (combinedCharges > 0) totals.push({ label: 'Shipping & packaging', amount: combinedCharges });
  }
  if (discount > 0) totals.push({ label: `Discount${clean(row.coupon_code || coupon.code) ? ` (${clean(row.coupon_code || coupon.code)})` : ''}`, amount: -discount });
  const adjustment = total - totals.reduce((sum, line) => sum + line.amount, 0);
  if (adjustment) totals.push({ label: 'Order adjustment', amount: adjustment });
  const date = row.created_at ? new Date(row.created_at) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const dateOptions = { timeZone: 'Asia/Kolkata' };
  const dateParts = validDate ? new Intl.DateTimeFormat('en-GB', { ...dateOptions, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(date!) : [];
  const part = (type: string) => dateParts.find((entry) => entry.type === type)?.value || '';
  return {
    orderId,
    invoiceNumber: `${orderId}${part('day')}${part('month')}${part('year')}`,
    orderDate: validDate ? new Intl.DateTimeFormat('en-US', { ...dateOptions, month: 'long', day: '2-digit', year: 'numeric' }).format(date!) : '',
    billing, shipping,
    showShippingAddress: addressPresent(shipping) && invoiceAddressKey(billing, clean(row.customer_name)) !== invoiceAddressKey(shipping, clean(row.customer_name)),
    customerName: clean(row.customer_name),
    customerEmail: clean(row.customer_email),
    paymentMethod: clean(payment.method || row.payment_method),
    paymentId: clean(payment.transactionId),
    items, totals, total, taxSummary, taxComplete, taxMode, placeOfSupply, supplyStateCode,
  };
};

export const orderInvoiceFilename = (orderId: string | number, row: { shipping_address?: unknown; customer_name?: unknown; created_at?: string | number | Date } = {}) => {
  const shipping = parseJson<any>(row.shipping_address, {}) || {};
  const name = clean(shipping.fullName || shipping.name || row.customer_name)
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/^[. ]+|[. ]+$/gu, '');
  const customer = Array.from(name).slice(0, 80).join('').trim() || 'Customer';
  const date = row.created_at ? new Date(row.created_at instanceof Date ? row.created_at.getTime() : row.created_at) : null;
  const dated = date && Number.isFinite(date.getTime())
    ? ` - ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)}` : '';
  return `${customer}${dated} - Invoice-${String(orderId).replace(/[^0-9]/g, '')}.pdf`;
};

export const buildOrderInvoicePdf = async (row: any, payment: InvoicePayment = {}): Promise<Buffer> => {
  const model = buildOrderInvoiceModel(row, payment);
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: {
    Title: `BrajMart Invoice ${model.invoiceNumber}`, Author: 'BRAJMART ECOMTECH LLP', Subject: `Order ${model.orderId}`,
  } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  // PDFKit shapes Hindi runs and embeds the fonts; Latin and Hindi share a line.
  doc.registerFont('Regular', path.join(ASSETS, 'NotoSans-Regular.ttf'));
  doc.registerFont('Bold', path.join(ASSETS, 'NotoSans-Bold.ttf'));
  doc.registerFont('Hindi', path.join(ASSETS, 'NotoSansDevanagari-Regular.ttf'));
  doc.registerFont('HindiBold', path.join(ASSETS, 'NotoSansDevanagari-Bold.ttf'));
  const runs = (value: string, bold: boolean) => (value.match(/[\u0900-\u097f]+|[^\u0900-\u097f]+/gu) || []).map((text) => ({
    text, font: /[\u0900-\u097f]/u.test(text) ? (bold ? 'HindiBold' : 'Hindi') : (bold ? 'Bold' : 'Regular'),
  }));
  const widthOf = (value: string, size: number, bold: boolean) => runs(value, bold).reduce((sum, run) => sum + doc.font(run.font).fontSize(size).widthOfString(run.text), 0);
  const linesOf = (value: string, width: number, size: number, bold: boolean) => {
    const lines: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.match(/\S+\s*/gu) || ['']) {
        if (line && widthOf(line + word.trimEnd(), size, bold) > width) { lines.push(line.trimEnd()); line = ''; }
        if (widthOf(word.trimEnd(), size, bold) > width) {
          for (const character of Array.from(word)) {
            if (line && widthOf(line + character, size, bold) > width) { lines.push(line); line = ''; }
            line += character;
          }
        } else line += word;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };
  const height = (value: string, width: number, size = 9, bold = false) => linesOf(value, width, size, bold).length * size * 1.4;
  const text = (value: unknown, x: number, y: number, width: number, options: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; color?: string; italic?: boolean } = {}) => {
    const size = options.size || 9;
    const bold = Boolean(options.bold);
    const lines = linesOf(clean(value), width, size, bold);
    for (const [index, line] of lines.entries()) {
      const lineWidth = widthOf(line, size, bold);
      let pen = x + (options.align === 'right' ? width - lineWidth : options.align === 'center' ? (width - lineWidth) / 2 : 0);
      for (const run of runs(line, bold)) {
        doc.font(run.font).fontSize(size).fillColor(options.color || '#000000').text(run.text, pen, y + index * size * 1.4, { lineBreak: false, oblique: options.italic });
        pen += doc.widthOfString(run.text);
      }
    }
    return y + lines.length * size * 1.4;
  };
  const line = (x1: number, y: number, x2: number, color = '#eadfd4') => doc.strokeColor(color).lineWidth(0.6).moveTo(x1, y).lineTo(x2, y).stroke();
  const labelled = (label: string, value: unknown, x: number, y: number, width: number, size = 9) => {
    const labelWidth = widthOf(`${label}:`, size, true);
    const labelEnd = text(`${label}:`, x, y, labelWidth + 1, { bold: true, size });
    const valueEnd = text(value, x + labelWidth + 3, y, width - labelWidth - 3, { size });
    return Math.max(labelEnd, valueEnd);
  };
  const heading = () => text('INVOICE', 15, 18, 565, { bold: true, size: 19, align: 'center' });
  heading();
  doc.image(path.join(ASSETS, 'brajmart-logo.png'), 30, 38, { width: 115, height: 75 });
  text('BRAJMART ECOMTECH LLP', 392, 34, 190, { bold: true, size: 10.5 });
  ['Block 7, Keshav Kunj, Raman Reti,', 'Near ISKCON Temple', 'Vrindavan, Uttar Pradesh'].forEach((value, index) => text(value, 392, 52 + index * 14.25, 190, { size: 9.5 }));
  [['Pin Code', '281121'], ['Phone', '+91 96343 59003'], ['GSTIN', '09ABGFB8096C1Z9'], ['Email', 'support@brajmart.com']].forEach(([label, value], index) => labelled(label, value, 392, 94.75 + index * 14.25, 190, 9.5));

  const addressBlock = (label: string, address: any, x: number, width: number, contacts: boolean) => {
    let y = text(label, x, 160, width, { bold: true });
    y = text(address.fullName || address.name || model.customerName, x, y, width, { bold: true });
    const addressLines = [address.street || address.address || address.addressLine1, address.addressLine2 || address.line2, [address.city, address.pincode || address.postalCode].filter(Boolean).join(' - '), address.state].filter((value) => clean(value));
    for (const value of addressLines) y = text(value, x, y, width);
    if (contacts) {
      y = labelled('Email', clean(address.email || model.customerEmail), x, y + 2, width);
      y = labelled('Phone', clean(address.mobile || address.phone || model.shipping.mobile || model.shipping.phone), x, y, width);
    }
    const alternate = alternateNumber(address) || (contacts && !model.showShippingAddress ? alternateNumber(model.shipping) : '');
    if (alternate) y = labelled('Alt No.', alternate, x, y, width);
    return y;
  };
  const billingEnd = addressBlock('Billing Details', model.billing, 34, model.showShippingAddress ? 170 : 300, true);
  const shippingEnd = model.showShippingAddress ? addressBlock('Shipping Details', model.shipping, 219, 128, false) : 0;
  let metadataEnd = 178;
  for (const [label, value] of [['Invoice Number:', model.invoiceNumber], ['Order Number:', model.orderId], ['Order Date:', model.orderDate], ['Payment Method:', model.paymentMethod], ['Payment ID:', model.paymentId], ['Place of Supply:', model.placeOfSupply ? `${model.placeOfSupply}${model.supplyStateCode ? ` (${model.supplyStateCode})` : ''}` : '-']]) {
    const end = text(value || '-', 441, metadataEnd, 130, { size: 8.5 });
    text(label, 350, metadataEnd, 80, { bold: true, size: 8.5, align: 'right' });
    metadataEnd = Math.max(end, metadataEnd + 13);
  }
  let y = Math.max(275, billingEnd + 10, shippingEnd + 10, metadataEnd + 10);
  if (y > 650) return fail(`Order ${model.orderId}: address details are too long for the invoice header`);
  const columns = [
    { label: 'Product', width: 195, align: 'left' as const },
    { label: 'HSN', width: 37, align: 'center' as const },
    { label: 'Unit', width: 28, align: 'center' as const },
    { label: 'Qty', width: 25, align: 'center' as const },
    { label: 'Rate', width: 53, align: 'right' as const },
    { label: 'Taxable', width: 60, align: 'right' as const },
    { label: 'GST', width: 34, align: 'right' as const },
    { label: model.taxMode === 'intra-state' ? 'CGST+SGST' : 'IGST', width: 61, align: 'right' as const },
    { label: 'Price', width: 67, align: 'right' as const },
  ].map((column, index, all) => ({ ...column, x: 15 + all.slice(0, index).reduce((sum, entry) => sum + entry.width, 0) }));
  const tableHeader = () => {
    doc.rect(15, y, 560, 20).fill('#000000');
    columns.forEach((column) => text(column.label, column.x + 4, y + 4, column.width - 8, { bold: true, size: 7, color: '#ffffff', align: column.align }));
    y += 20;
  };
  const continuation = () => {
    doc.addPage(); heading();
    text(`Invoice Number: ${model.invoiceNumber}  |  Order Number: ${model.orderId}`, 34, 53, 530, { size: 9 });
    y = 80; tableHeader();
  };
  tableHeader();
  model.items.forEach((item, index) => {
    const productWidth = columns[0].width - 8;
    const details = [item.variants, item.sku ? `SKU: ${item.sku}` : '', item.discount ? `Discount: ${money(item.discount)}` : ''].filter(Boolean);
    const productHeight = height(item.name, productWidth, 8) + details.reduce((sum, detail) => sum + height(detail, productWidth, 7) + 2, 0);
    const values = [item.name, item.hsnCode || '-', item.unit || '-', String(item.quantity), money(item.price), item.taxable === null ? '-' : money(item.taxable), item.gstRate === null ? '-' : `${item.gstRate}%`, item.tax === null ? '-' : money(item.tax), money(item.netTotal)];
    const rowHeight = Math.max(25, productHeight + 12, ...columns.slice(1).map((column, i) => height(values[i + 1], column.width - 8, 7) + 12));
    if (rowHeight > 640) return fail(`Order ${model.orderId}: item ${index + 1} is too long for an invoice page`);
    if (y + rowHeight > 740) continuation();
    let productEnd = text(item.name, 19, y + 6, productWidth, { size: 8 });
    for (const detail of details) productEnd = text(detail, 19, productEnd + 2, productWidth, { size: 7, color: '#444444' });
    columns.slice(1).forEach((column, i) => text(values[i + 1], column.x + 4, y + 6, column.width - 8, { size: 7, align: column.align }));
    y += rowHeight; line(15, y, 575);
  });
  const summaryRows = [...model.totals, ...model.taxSummary];
  const notes = [
    model.taxComplete ? 'Prices are inclusive of applicable GST. Tax shown above is included in product prices.' : 'GST breakdown unavailable for items without a saved GST rate. Missing HSN/unit shown as -.',
    model.items.some((item) => item.discount) ? 'Price is after product discount; taxable value and GST use the discounted amount.' : '',
  ].filter(Boolean).join('\n');
  const totalsHeight = summaryRows.reduce((sum, entry) => sum + Math.max(14, height(entry.label, 145, 8, true)), 0) + 48 + height(notes, 540, 7);
  if (y + totalsHeight > 750) continuation();
  y += 9;
  for (const entry of summaryRows) {
    const label = entry.label === 'Subtotal' && model.items.some((item) => item.discount) ? 'Subtotal (before discount)' : entry.label;
    const end = text(label, 340, y, 145, { bold: true, size: 8 });
    const amountEnd = text(`${entry.amount < 0 ? '-' : ''}${money(Math.abs(entry.amount))}`, 490, y, 75, { size: 8, align: 'right' });
    y = Math.max(y + 12.5, end, amountEnd);
  }
  line(336, y + 3, 571, '#222222');
  text('Total', 393, y + 7, 70, { bold: true });
  text(money(model.total), 465, y + 5, 100, { bold: true, size: 11, align: 'right' });
  line(336, y + 24, 571, '#222222');
  text(notes, 25, y + 32, 540, { size: 7, align: 'right', italic: true });
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page++) {
    doc.switchToPage(page);
    line(26, 772, 571);
    text('Thank you for shopping with BrajMart', 26, 777, 545, { size: 8, align: 'center' });
    text('www.brajmart.com', 26, 788, 545, { size: 8, align: 'center' });
    if (pages.count > 1) text(`Page ${page + 1} of ${pages.count}`, 470, 802, 100, { size: 7, align: 'right' });
  }
  doc.end();
  return result;
};
