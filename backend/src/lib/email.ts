import nodemailer from 'nodemailer';
import { dbQuery, isDbConnected } from './db';

let cachedTransporter: nodemailer.Transporter | null = null;
let verifiedOnce = false;

const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@brajmart.com';
  return { apiKey, from };
};

const asNumber = (value: any, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const shouldRetryWithAltPort = (err: any) => {
  const code = String(err?.code || '').toUpperCase();
  const message = String(err?.message || '').toLowerCase();
  return (
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('econnrefused')
  );
};

const createTransporter = (opts: { host: string; port: number; user: string; pass: string }) => {
  const secure = opts.port === 465;
  const rejectUnauthorizedEnv = process.env.SMTP_TLS_REJECT_UNAUTHORIZED;
  const rejectUnauthorized = rejectUnauthorizedEnv === undefined ? true : !(String(rejectUnauthorizedEnv).toLowerCase() === 'false' || String(rejectUnauthorizedEnv) === '0');

  return nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure,
    auth: { user: opts.user, pass: opts.pass },
    requireTLS: !secure, // for 587 (STARTTLS)
    connectionTimeout: asNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 15_000),
    greetingTimeout: asNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 15_000),
    socketTimeout: asNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20_000),
    tls: {
      servername: opts.host,
      rejectUnauthorized,
    },
  });
};

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = createTransporter({ host, port, user, pass });
  return cachedTransporter;
};

const sendViaResend = async (to: string, subject: string, html: string) => {
  const { apiKey, from } = getResendConfig();
  if (!apiKey) throw new Error('Resend not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `Resend request failed (${res.status})`;
    throw new Error(msg);
  }
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@brajmart.com';
  const from = `BrajMart <${fromAddress}>`;

  // Prefer HTTPS-based email providers in production since many hosts block outbound SMTP ports.
  const preferProvider = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (preferProvider === 'resend' || process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, html);
    console.log('Email sent (resend)', { to, subject });
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('SMTP not configured');
  }
  try {
    if (!verifiedOnce) {
      await transporter.verify();
      verifiedOnce = true;
    }
    await transporter.sendMail({ from, to, subject, html });
    console.log('Email sent', { to, subject });
  } catch (err) {
    // Render/Cloud hosts often block port 465; if it times out, retry on 587 automatically.
    try {
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (host && user && pass && shouldRetryWithAltPort(err)) {
        const altPort = port === 465 ? 587 : 465;
        const alt = createTransporter({ host, port: altPort, user, pass });
        await alt.verify();
        await alt.sendMail({ from, to, subject, html });
        cachedTransporter = alt;
        verifiedOnce = true;
        console.log('Email sent (retry)', { to, subject, port: altPort });
        return;
      }
    } catch (retryErr) {
      console.error('Email retry failed', retryErr);
    }

    console.error('Email send failed', err);
    throw err;
  }
};

const escapeHtml = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveAssetUrl = (value?: string) => {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:|data:)/i.test(url)) return url;
  const base = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');
  return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : '';
};

const getEmailBrand = async () => {
  const fallback = {
    storeName: 'BrajMart',
    tagline: 'Authentic Vrindavan Products',
    storeAddress: '',
    storeEmail: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '',
    storePhone: '',
    storeLogo: resolveAssetUrl(process.env.STORE_LOGO_URL || process.env.COMPANY_LOGO_URL || ''),
  };

  if (!isDbConnected()) return fallback;

  try {
    const rows = await dbQuery<any>('SELECT store_name, tagline, store_address, store_email, store_phone, store_logo FROM settings LIMIT 1');
    const row = rows?.[0];
    if (!row) return fallback;
    return {
      storeName: row.store_name || fallback.storeName,
      tagline: row.tagline || fallback.tagline,
      storeAddress: row.store_address || fallback.storeAddress,
      storeEmail: row.store_email || fallback.storeEmail,
      storePhone: row.store_phone || fallback.storePhone,
      storeLogo: resolveAssetUrl(row.store_logo) || fallback.storeLogo,
    };
  } catch {
    return fallback;
  }
};

const brandWrapper = async (title: string, body: string) => {
  const brand = await getEmailBrand();
  const logoHtml = brand.storeLogo
    ? `<img src="${escapeHtml(brand.storeLogo)}" alt="${escapeHtml(brand.storeName)}" style="height:46px;width:auto;object-fit:contain;display:block;margin-bottom:8px;" />`
    : `<div style="font-size:18px;font-weight:700;letter-spacing:.2px;">${escapeHtml(brand.storeName)}</div>`;

  return `
  <div style="background:#f7f4ef;padding:24px;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #eadfce;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#d8b24d,#c58f1f);padding:18px 24px;color:#3b1c12;">
        ${logoHtml}
        <div style="font-size:12px;opacity:.85;">${escapeHtml(brand.tagline)}</div>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#3b1c12;">${escapeHtml(title)}</h2>
        <div style="color:#4b3f32;font-size:14px;line-height:1.6;">
          ${body}
        </div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #f0e6d6;color:#8a7b6a;font-size:12px;">
        Need help? Reply to this email and our team will assist you.
        ${brand.storePhone ? `<br/>Phone: ${escapeHtml(brand.storePhone)}` : ''}
        ${brand.storeAddress ? `<br/>${escapeHtml(brand.storeAddress)}` : ''}
      </div>
    </div>
  </div>
`;
};

type OrderItem = { name?: string; quantity?: number; price?: number };
type OrderAddress = { fullName?: string; mobile?: string; street?: string; city?: string; state?: string; pincode?: string };
type OrderPriceBreakdown = {
  itemsSubtotal?: number;
  shippingAmount?: number;
  packagingAmount?: number;
  packagingRate?: number;
  total?: number;
};

const formatMoney = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  return `&#8377;${Number(value).toLocaleString('en-IN')}`;
};

const renderItemsTable = (items?: OrderItem[]) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  const rows = items.map((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const subtotal = qty * price;
    return `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #efe6d6;">${escapeHtml(item.name || 'Item')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #efe6d6;text-align:center;">${qty || 1}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #efe6d6;text-align:right;">${formatMoney(price)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #efe6d6;text-align:right;">${formatMoney(subtotal)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 6px;border-bottom:1px solid #dbcdb8;">Item</th>
          <th style="text-align:center;padding:8px 6px;border-bottom:1px solid #dbcdb8;">Qty</th>
          <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #dbcdb8;">Price</th>
          <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #dbcdb8;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const renderAddress = (label: string, addr?: OrderAddress) => {
  if (!addr) return '';
  const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  const hasAny = addr.fullName || addr.mobile || parts;
  if (!hasAny) return '';
  return `
    <p style="margin:8px 0 4px;"><strong>${label}</strong></p>
    <p style="margin:0;">${escapeHtml(addr.fullName || '')}${addr.mobile ? `, ${escapeHtml(addr.mobile)}` : ''}</p>
    ${parts ? `<p style="margin:2px 0 0;">${escapeHtml(parts)}</p>` : ''}
  `;
};

const renderOrderDetails = (payload: {
  items?: OrderItem[];
  paymentMethod?: string;
  transactionId?: string;
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
} & OrderPriceBreakdown) => {
  const itemsHtml = renderItemsTable(payload.items);
  const calculatedSubtotal = Array.isArray(payload.items)
    ? payload.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
    : undefined;
  const subtotal = payload.itemsSubtotal ?? calculatedSubtotal;
  const hasExactBreakdown = payload.shippingAmount !== undefined || payload.packagingAmount !== undefined;
  const legacyAdjustment = !hasExactBreakdown && payload.total !== undefined && subtotal !== undefined
    ? Math.max(0, Number(payload.total) - subtotal)
    : 0;
  const pricingHtml = payload.total !== undefined ? `
    <div style="margin:14px 0;padding:14px;background:#fffaf2;border:1px solid #eadfce;border-radius:10px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#4b3f32;">
        <tr>
          <td style="padding:0 0 9px;">Product price</td>
          <td style="width:140px;padding:0 0 9px 32px;text-align:right;font-weight:700;white-space:nowrap;">${formatMoney(subtotal)}</td>
        </tr>
        ${hasExactBreakdown ? `
          <tr>
            <td style="padding:0 0 9px;">Packaging cost${payload.packagingRate ? ` (${Number(payload.packagingRate)}%)` : ''}</td>
            <td style="width:140px;padding:0 0 9px 32px;text-align:right;font-weight:700;white-space:nowrap;">${formatMoney(payload.packagingAmount || 0)}</td>
          </tr>
          <tr>
            <td style="padding:0 0 12px;">Shipping charge</td>
            <td style="width:140px;padding:0 0 12px 32px;text-align:right;font-weight:700;white-space:nowrap;">${Number(payload.shippingAmount || 0) === 0 ? 'FREE' : formatMoney(payload.shippingAmount)}</td>
          </tr>
        ` : legacyAdjustment > 0 ? `
          <tr>
            <td style="padding:0 0 12px;">Packaging &amp; shipping</td>
            <td style="width:140px;padding:0 0 12px 32px;text-align:right;font-weight:700;white-space:nowrap;">${formatMoney(legacyAdjustment)}</td>
          </tr>` : ''}
        <tr>
          <td style="padding:12px 0 0;border-top:1px solid #dbcdb8;font-size:16px;font-weight:700;color:#3b1c12;">Order total</td>
          <td style="width:140px;padding:12px 0 0 32px;border-top:1px solid #dbcdb8;text-align:right;font-size:16px;font-weight:800;color:#3b1c12;white-space:nowrap;">${formatMoney(payload.total)}</td>
        </tr>
      </table>
    </div>` : '';
  const methodHtml = payload.paymentMethod ? `<p><strong>Payment Method:</strong> ${escapeHtml(payload.paymentMethod)}</p>` : '';
  const txnHtml = payload.transactionId ? `<p><strong>Transaction ID:</strong> ${escapeHtml(payload.transactionId)}</p>` : '';
  const shipHtml = renderAddress('Shipping Address', payload.shippingAddress);
  const billHtml = renderAddress('Billing Address', payload.billingAddress);
  return `
    ${itemsHtml}
    ${pricingHtml}
    ${methodHtml}
    ${txnHtml}
    ${shipHtml}
    ${billHtml}
  `;
};

export const sendOrderConfirmation = async (to: string, payload: { orderId: string; total: number; itemsCount: number; eta?: string; items?: OrderItem[]; paymentMethod?: string; shippingAddress?: OrderAddress; billingAddress?: OrderAddress } & OrderPriceBreakdown) => {
  const html = await brandWrapper(
    'Order Confirmed',
    `<p>Your order <strong>${escapeHtml(payload.orderId)}</strong> has been placed successfully.</p>
     <p>Items: ${payload.itemsCount}</p>
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${escapeHtml(payload.eta)}</p>` : ''}
     ${renderOrderDetails({
       items: payload.items,
       total: payload.total,
       itemsSubtotal: payload.itemsSubtotal,
       shippingAmount: payload.shippingAmount,
       packagingAmount: payload.packagingAmount,
       packagingRate: payload.packagingRate,
       paymentMethod: payload.paymentMethod,
       shippingAddress: payload.shippingAddress,
       billingAddress: payload.billingAddress,
     })}`
  );
  await sendEmail(to, 'Your BrajMart Order Confirmation', html);
};

export const sendPaymentReceipt = async (to: string, payload: { orderId: string; amount: number; paymentId: string; invoiceNumber?: number | string; orderDate?: string; paidAt?: string; eta?: string; details?: ({ items?: OrderItem[]; paymentMethod?: string; transactionId?: string; shippingAddress?: OrderAddress; billingAddress?: OrderAddress } & OrderPriceBreakdown) }) => {
  const invoiceNumber = payload.invoiceNumber ? String(payload.invoiceNumber) : payload.orderId;
  const paidAt = payload.paidAt || new Date().toISOString();
  const html = await brandWrapper(
    'Tax Invoice',
    `<div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px;">
       <div>
         <p style="margin:0;color:#8a6d4e;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Invoice</p>
         <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#3b1c12;">#${escapeHtml(invoiceNumber)}</p>
       </div>
       <div style="text-align:right;font-size:12px;color:#6f6254;">
         <p style="margin:0;"><strong>Order:</strong> ${escapeHtml(payload.orderId)}</p>
         ${payload.orderDate ? `<p style="margin:3px 0 0;"><strong>Order date:</strong> ${escapeHtml(new Date(payload.orderDate).toLocaleDateString('en-IN'))}</p>` : ''}
         <p style="margin:3px 0 0;"><strong>Paid on:</strong> ${escapeHtml(new Date(paidAt).toLocaleDateString('en-IN'))}</p>
       </div>
     </div>
     <p>Thank you. Your payment has been received successfully and your invoice is ready.</p>
     ${payload.details ? renderOrderDetails({ ...payload.details, transactionId: payload.paymentId }) : ''}
     <div style="margin-top:14px;padding:14px;background:#fff8e6;border:1px solid #ead8a6;border-radius:10px;">
       <p style="margin:0;"><strong>Payment Status:</strong> Paid</p>
       <p style="margin:5px 0 0;"><strong>Amount Paid:</strong> ${formatMoney(payload.amount)}</p>
       <p style="margin:5px 0 0;"><strong>Payment ID:</strong> ${escapeHtml(payload.paymentId)}</p>
       ${payload.eta ? `<p style="margin:5px 0 0;"><strong>Estimated delivery:</strong> ${escapeHtml(payload.eta)}</p>` : ''}
     </div>`
  );
  await sendEmail(to, `BrajMart Invoice #${invoiceNumber}`, html);
};

export const sendPaymentFailed = async (to: string, payload: { orderId: string; amount: number; paymentId?: string; eta?: string; details?: ({ items?: OrderItem[]; paymentMethod?: string; transactionId?: string; shippingAddress?: OrderAddress; billingAddress?: OrderAddress } & OrderPriceBreakdown) }) => {
  const html = await brandWrapper(
    'Payment Failed',
    `<p>Your payment for Order <strong>${escapeHtml(payload.orderId)}</strong> could not be completed.</p>
     <p>Amount: &#8377;${payload.amount}</p>
     ${payload.paymentId ? `<p>Payment ID: ${escapeHtml(payload.paymentId)}</p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${escapeHtml(payload.eta)}</p>` : ''}
     <p>Please try again or choose another payment method.</p>
     ${payload.details ? renderOrderDetails(payload.details) : ''}`
  );
  await sendEmail(to, 'BrajMart Payment Failed', html);
};

export const sendAdminPaymentNotice = async (payload: { status: 'paid' | 'failed'; orderId: string; amount: number; paymentId?: string; method: string; customerEmail?: string }) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!adminEmail) return;
  const html = await brandWrapper(
    payload.status === 'paid' ? 'Payment Received' : 'Payment Failed',
    `<p><strong>Status:</strong> ${payload.status.toUpperCase()}</p>
     <p><strong>Order ID:</strong> ${escapeHtml(payload.orderId)}</p>
     <p><strong>Amount:</strong> &#8377;${payload.amount}</p>
     <p><strong>Method:</strong> ${escapeHtml(payload.method)}</p>
     ${payload.paymentId ? `<p><strong>Payment ID:</strong> ${escapeHtml(payload.paymentId)}</p>` : ''}
     ${payload.customerEmail ? `<p><strong>Customer:</strong> ${escapeHtml(payload.customerEmail)}</p>` : ''}`
  );
  await sendEmail(adminEmail, `Payment ${payload.status === 'paid' ? 'Success' : 'Failed'} - ${payload.orderId}`, html);
};

export const sendShippingUpdate = async (to: string, payload: { orderId: string; status: string; trackingId?: string; eta?: string; details?: ({ items?: OrderItem[]; paymentMethod?: string; transactionId?: string; shippingAddress?: OrderAddress; billingAddress?: OrderAddress } & OrderPriceBreakdown) }) => {
  const frontendUrl = String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  const trackingUrl = payload.trackingId && frontendUrl
    ? `${frontendUrl}/track-order?orderId=${encodeURIComponent(payload.trackingId)}`
    : '';
  const html = await brandWrapper(
    'Shipping Update',
    `<p>Your order <strong>${escapeHtml(payload.orderId)}</strong> status is now <strong>${escapeHtml(payload.status)}</strong>.</p>
     ${payload.trackingId ? `<p>Tracking ID: ${escapeHtml(payload.trackingId)}</p>` : ''}
     ${trackingUrl ? `<p><a href="${trackingUrl}" style="display:inline-block;padding:10px 16px;background:#c58f1f;color:#fff;text-decoration:none;border-radius:8px;">Track your order</a></p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${escapeHtml(payload.eta)}</p>` : ''}
     ${payload.details ? renderOrderDetails(payload.details) : ''}`
  );
  await sendEmail(to, 'BrajMart Shipping Update', html);
};

export const sendVerifyEmail = async (to: string, payload: { link: string }) => {
  const html = await brandWrapper(
    'Verify Your Email',
    `<p>Thanks for creating your BrajMart account.</p>
     <p>Please verify your email address by clicking the button below:</p>
     <p><a href="${payload.link}" style="display:inline-block;padding:10px 16px;background:#c58f1f;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p>
     <p>If the button does not work, copy and paste this link:</p>
     <p style="word-break:break-all;">${payload.link}</p>`
  );
  await sendEmail(to, 'Verify your BrajMart email', html);
};

export const sendVerifyOtp = async (to: string, payload: { otp: string; minutes: number }) => {
  const html = await brandWrapper(
    'Your Verification Code',
    `<p>Use the verification code below to complete your sign up.</p>
     <p style="font-size:22px;letter-spacing:4px;font-weight:700;color:#3b1c12;">${payload.otp}</p>
     <p>This code expires in ${payload.minutes} minutes.</p>`
  );
  await sendEmail(to, 'Your BrajMart verification code', html);
};

export const sendPasswordResetOtp = async (to: string, payload: { otp: string; minutes: number }) => {
  const html = await brandWrapper(
    'Password Reset Code',
    `<p>Use the code below to sign in and reset your password.</p>
     <p style="font-size:22px;letter-spacing:4px;font-weight:700;color:#3b1c12;">${payload.otp}</p>
     <p>This code expires in ${payload.minutes} minutes.</p>
     <p>If you didn’t request this, you can ignore this email.</p>`
  );
  await sendEmail(to, 'Your BrajMart password reset code', html);
};
