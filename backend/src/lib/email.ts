import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@brajmart.com';
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('SMTP not configured. Skipping email send.');
    return;
  }
  await transporter.sendMail({ from, to, subject, html });
};

const brandWrapper = (title: string, body: string) => `
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

export const sendOrderConfirmation = async (to: string, payload: { orderId: string; total: number; itemsCount: number; eta?: string }) => {
  const html = brandWrapper(
    'Order Confirmed',
    `<p>Your order <strong>${payload.orderId}</strong> has been placed successfully.</p>
     <p>Items: ${payload.itemsCount}</p>
     <p>Total: &#8377;${payload.total}</p>
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}`
  );
  await sendEmail(to, 'Your BrajMart Order Confirmation', html);
};

export const sendPaymentReceipt = async (to: string, payload: { orderId: string; amount: number; paymentId: string; eta?: string }) => {
  const html = brandWrapper(
    'Payment Received',
    `<p>Payment received for Order <strong>${payload.orderId}</strong>.</p>
     <p>Amount: &#8377;${payload.amount}</p>
     <p>Payment ID: ${payload.paymentId}</p>
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}`
  );
  await sendEmail(to, 'BrajMart Payment Receipt', html);
};

export const sendPaymentFailed = async (to: string, payload: { orderId: string; amount: number; paymentId?: string; eta?: string }) => {
  const html = brandWrapper(
    'Payment Failed',
    `<p>Your payment for Order <strong>${payload.orderId}</strong> could not be completed.</p>
     <p>Amount: &#8377;${payload.amount}</p>
     ${payload.paymentId ? `<p>Payment ID: ${payload.paymentId}</p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}
     <p>Please try again or choose another payment method.</p>`
  );
  await sendEmail(to, 'BrajMart Payment Failed', html);
};

export const sendAdminPaymentNotice = async (payload: { status: 'paid' | 'failed'; orderId: string; amount: number; paymentId?: string; method: string; customerEmail?: string }) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!adminEmail) return;
  const html = brandWrapper(
    payload.status === 'paid' ? 'Payment Received' : 'Payment Failed',
    `<p><strong>Status:</strong> ${payload.status.toUpperCase()}</p>
     <p><strong>Order ID:</strong> ${payload.orderId}</p>
     <p><strong>Amount:</strong> &#8377;${payload.amount}</p>
     <p><strong>Method:</strong> ${payload.method}</p>
     ${payload.paymentId ? `<p><strong>Payment ID:</strong> ${payload.paymentId}</p>` : ''}
     ${payload.customerEmail ? `<p><strong>Customer:</strong> ${payload.customerEmail}</p>` : ''}`
  );
  await sendEmail(adminEmail, `Payment ${payload.status === 'paid' ? 'Success' : 'Failed'} - ${payload.orderId}`, html);
};

export const sendShippingUpdate = async (to: string, payload: { orderId: string; status: string; trackingId?: string; eta?: string }) => {
  const html = brandWrapper(
    'Shipping Update',
    `<p>Your order <strong>${payload.orderId}</strong> status is now <strong>${payload.status}</strong>.</p>
     ${payload.trackingId ? `<p>Tracking ID: ${payload.trackingId}</p>` : ''}
     ${payload.eta ? `<p><strong>Estimated delivery:</strong> ${payload.eta}</p>` : ''}`
  );
  await sendEmail(to, 'BrajMart Shipping Update', html);
};

export const sendVerifyEmail = async (to: string, payload: { link: string }) => {
  const html = brandWrapper(
    'Verify Your Email',
    `<p>Thanks for creating your BrajMart account.</p>
     <p>Please verify your email address by clicking the button below:</p>
     <p><a href="${payload.link}" style="display:inline-block;padding:10px 16px;background:#c58f1f;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p>
     <p>If the button does not work, copy and paste this link:</p>
     <p style="word-break:break-all;">${payload.link}</p>`
  );
  await sendEmail(to, 'Verify your BrajMart email', html);
};
