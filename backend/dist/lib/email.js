"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerifyOtp = exports.sendVerifyEmail = exports.sendShippingUpdate = exports.sendAdminPaymentNotice = exports.sendPaymentFailed = exports.sendPaymentReceipt = exports.sendOrderConfirmation = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
let cachedTransporter = null;
let verifiedOnce = false;
const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass)
        return null;
    if (cachedTransporter)
        return cachedTransporter;
    cachedTransporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
            servername: host,
            rejectUnauthorized: false,
        },
    });
    return cachedTransporter;
};
const sendEmail = async (to, subject, html) => {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@brajmart.com';
    const from = `BrajMart <${fromAddress}>`;
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
    }
    catch (err) {
        console.error('Email send failed', err);
        throw err;
    }
};
exports.sendEmail = sendEmail;
const brandWrapper = (title, body) => `
  <div style="background:#f7f4ef;padding:24px;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #eadfce;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#d8b24d,#c58f1f);padding:18px 24px;color:#3b1c12;">
        <div style="font-size:18px;font-weight:700;letter-spacing:.2px;">BrajMart</div>
        <div style="font-size:12px;opacity:.85;">Authentic Vrindavan Products</div>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#3b1c12;">${title}</h2>
        <div style="color:#4b3f32;font-size:14px;line-height:1.6;">
          ${body}
        </div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #f0e6d6;color:#8a7b6a;font-size:12px;">
        Need help? Reply to this email and our team will assist you.
      </div>
    </div>
  </div>
`;
const formatMoney = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value)))
        return '';
    return `&#8377;${Number(value).toLocaleString('en-IN')}`;
};
const renderItemsTable = (items) => {
    if (!Array.isArray(items) || items.length === 0)
        return '';
    const rows = items.map((item) => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const subtotal = qty * price;
        return `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #efe6d6;">${item.name || 'Item'}</td>
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
const renderAddress = (label, addr) => {
    if (!addr)
        return '';
    const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    const hasAny = addr.fullName || addr.mobile || parts;
    if (!hasAny)
        return '';
    return `
    <p style="margin:8px 0 4px;"><strong>${label}</strong></p>
    <p style="margin:0;">${addr.fullName || ''}${addr.mobile ? `, ${addr.mobile}` : ''}</p>
    ${parts ? `<p style="margin:2px 0 0;">${parts}</p>` : ''}
  `;
};
const renderOrderDetails = (payload) => {
    const itemsHtml = renderItemsTable(payload.items);
    const totalHtml = payload.total !== undefined ? `<p><strong>Total:</strong> ${formatMoney(payload.total)}</p>` : '';
    const methodHtml = payload.paymentMethod ? `<p><strong>Payment Method:</strong> ${payload.paymentMethod}</p>` : '';
    const txnHtml = payload.transactionId ? `<p><strong>Transaction ID:</strong> ${payload.transactionId}</p>` : '';
    const shipHtml = renderAddress('Shipping Address', payload.shippingAddress);
    const billHtml = renderAddress('Billing Address', payload.billingAddress);
    return `
    ${itemsHtml}
    ${totalHtml}
    ${methodHtml}
    ${txnHtml}
    ${shipHtml}
    ${billHtml}
  `;
};
const sendOrderConfirmation = async (to, payload) => {
    const html = brandWrapper('Order Confirmed', `<p>Your order <strong>${payload.orderId}</strong> has been placed successfully.</p>
     <p>Items: ${payload.itemsCount}</p>
     <p>Total: &#8377;${payload.total}</p>
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}
     ${renderOrderDetails({
        items: payload.items,
        total: payload.total,
        paymentMethod: payload.paymentMethod,
        shippingAddress: payload.shippingAddress,
        billingAddress: payload.billingAddress,
    })}`);
    await (0, exports.sendEmail)(to, 'Your BrajMart Order Confirmation', html);
};
exports.sendOrderConfirmation = sendOrderConfirmation;
const sendPaymentReceipt = async (to, payload) => {
    const html = brandWrapper('Payment Received', `<p>Payment received for Order <strong>${payload.orderId}</strong>.</p>
     <p>Amount: &#8377;${payload.amount}</p>
     <p>Payment ID: ${payload.paymentId}</p>
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}
     ${payload.details ? renderOrderDetails(payload.details) : ''}`);
    await (0, exports.sendEmail)(to, 'BrajMart Payment Receipt', html);
};
exports.sendPaymentReceipt = sendPaymentReceipt;
const sendPaymentFailed = async (to, payload) => {
    const html = brandWrapper('Payment Failed', `<p>Your payment for Order <strong>${payload.orderId}</strong> could not be completed.</p>
     <p>Amount: &#8377;${payload.amount}</p>
     ${payload.paymentId ? `<p>Payment ID: ${payload.paymentId}</p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}
     <p>Please try again or choose another payment method.</p>
     ${payload.details ? renderOrderDetails(payload.details) : ''}`);
    await (0, exports.sendEmail)(to, 'BrajMart Payment Failed', html);
};
exports.sendPaymentFailed = sendPaymentFailed;
const sendAdminPaymentNotice = async (payload) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!adminEmail)
        return;
    const html = brandWrapper(payload.status === 'paid' ? 'Payment Received' : 'Payment Failed', `<p><strong>Status:</strong> ${payload.status.toUpperCase()}</p>
     <p><strong>Order ID:</strong> ${payload.orderId}</p>
     <p><strong>Amount:</strong> &#8377;${payload.amount}</p>
     <p><strong>Method:</strong> ${payload.method}</p>
     ${payload.paymentId ? `<p><strong>Payment ID:</strong> ${payload.paymentId}</p>` : ''}
     ${payload.customerEmail ? `<p><strong>Customer:</strong> ${payload.customerEmail}</p>` : ''}`);
    await (0, exports.sendEmail)(adminEmail, `Payment ${payload.status === 'paid' ? 'Success' : 'Failed'} - ${payload.orderId}`, html);
};
exports.sendAdminPaymentNotice = sendAdminPaymentNotice;
const sendShippingUpdate = async (to, payload) => {
    const html = brandWrapper('Shipping Update', `<p>Your order <strong>${payload.orderId}</strong> status is now <strong>${payload.status}</strong>.</p>
     ${payload.trackingId ? `<p>Tracking ID: ${payload.trackingId}</p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}
     ${payload.details ? renderOrderDetails(payload.details) : ''}`);
    await (0, exports.sendEmail)(to, 'BrajMart Shipping Update', html);
};
exports.sendShippingUpdate = sendShippingUpdate;
const sendVerifyEmail = async (to, payload) => {
    const html = brandWrapper('Verify Your Email', `<p>Thanks for creating your BrajMart account.</p>
     <p>Please verify your email address by clicking the button below:</p>
     <p><a href="${payload.link}" style="display:inline-block;padding:10px 16px;background:#c58f1f;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p>
     <p>If the button does not work, copy and paste this link:</p>
     <p style="word-break:break-all;">${payload.link}</p>`);
    await (0, exports.sendEmail)(to, 'Verify your BrajMart email', html);
};
exports.sendVerifyEmail = sendVerifyEmail;
const sendVerifyOtp = async (to, payload) => {
    const html = brandWrapper('Your Verification Code', `<p>Use the verification code below to complete your sign up.</p>
     <p style="font-size:22px;letter-spacing:4px;font-weight:700;color:#3b1c12;">${payload.otp}</p>
     <p>This code expires in ${payload.minutes} minutes.</p>`);
    await (0, exports.sendEmail)(to, 'Your BrajMart verification code', html);
};
exports.sendVerifyOtp = sendVerifyOtp;
