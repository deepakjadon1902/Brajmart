import { createHash, randomBytes } from 'crypto';
import { dbExecute, dbQuery, isDbConnected, withDbTransaction } from './db';
import { EmailProviderResponseError, sendCartReminderEmail, sendCouponOfferEmail, sendPendingPaymentReminderEmail } from './email';
import { parseJson } from './dbHelpers';
import { priceAndValidateOrderItems } from './orderPricing';

const MAX_ATTEMPTS = 3;
const STALE_SEND_MINUTES = 15;
const RUN_INTERVAL_MS = 60_000;
const EMAIL_RETRY_MINUTES = 5;
const CART_REMINDER_DELAY_HOURS = 4;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class FollowupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FollowupValidationError';
  }
}

export type FollowupConsent = {
  cartReminder: boolean;
  offerEmail: boolean;
  whatsappFollowup: boolean;
};

const publicBaseUrl = () => {
  const configured = String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || process.env.SITE_URL || process.env.APP_URL || 'https://brajmart.com').trim();
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return 'https://brajmart.com';
    return url.origin;
  } catch {
    return 'https://brajmart.com';
  }
};

export const normalizeCustomerEmail = (value: unknown) => String(value || '').trim().toLowerCase();

export const isValidCustomerEmail = (email: string) =>
  email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const getCouponCampaignKey = (coupon: any) => hash(`coupon-offer:${JSON.stringify({
  id: coupon.id,
  updatedAt: coupon.updated_at,
  code: coupon.code,
  title: coupon.title,
  discountType: coupon.discount_type,
  discountValue: coupon.discount_value,
  maxDiscount: coupon.max_discount,
  freeShipping: coupon.free_shipping,
  freePackaging: coupon.free_packaging,
  scopeType: coupon.scope_type,
  scopeValue: coupon.scope_value,
  minOrderAmount: coupon.min_order_amount,
  startsAt: coupon.starts_at,
  endsAt: coupon.ends_at,
})}`);

export const captureEmailFollowup = async (input: {
  email: string;
  customerName: string;
  userId: string | null;
  items: any[];
  consent: FollowupConsent;
}) => {
  if (!isDbConnected()) throw new Error('Database unavailable');
  const email = normalizeCustomerEmail(input.email);
  if (!isValidCustomerEmail(email)) throw new FollowupValidationError('Enter a valid email address');
  if (!input.consent.cartReminder && !input.consent.offerEmail && !input.consent.whatsappFollowup) {
    throw new FollowupValidationError('At least one contact preference must be selected');
  }

  let pricedItems: any[] = [];
  let itemsSubtotal = 0;
  if (input.consent.cartReminder) {
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 120) {
      throw new FollowupValidationError('The cart is empty or contains too many items');
    }
    const priced = await priceAndValidateOrderItems(input.items);
    if (!priced.ok) throw new FollowupValidationError(priced.message || 'Cart could not be verified');
    pricedItems = priced.items;
    itemsSubtotal = priced.itemsSubtotal;
  }

  const customerName = String(input.customerName || '').trim().slice(0, 255);
  const userId = input.userId && /^\d+$/.test(input.userId) ? Number(input.userId) : null;
  const idempotencyKey = hash(`cart-reminder:${email}:${randomBytes(24).toString('hex')}`);

  await withDbTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO email_contact_preferences
        (email, user_id, customer_name, cart_reminder_consent, offer_email_consent, whatsapp_followup_consent,
         cart_reminder_consented_at, offer_email_consented_at, whatsapp_followup_consented_at, consent_source, consent_version)
       VALUES (?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL), IF(? = 1, NOW(), NULL), IF(? = 1, NOW(), NULL), 'checkout', 'checkout-contact-v1')
       ON DUPLICATE KEY UPDATE
         user_id = COALESCE(VALUES(user_id), user_id),
         customer_name = IF(VALUES(customer_name) <> '', VALUES(customer_name), customer_name),
         cart_reminder_consented_at = IF(VALUES(cart_reminder_consent) = 1, NOW(), cart_reminder_consented_at),
         offer_email_consented_at = IF(VALUES(offer_email_consent) = 1, NOW(), offer_email_consented_at),
         whatsapp_followup_consented_at = IF(VALUES(whatsapp_followup_consent) = 1, NOW(), whatsapp_followup_consented_at),
         consent_source = 'checkout',
         consent_version = 'checkout-contact-v1',
         cart_reminder_consent = GREATEST(cart_reminder_consent, VALUES(cart_reminder_consent)),
         offer_email_consent = GREATEST(offer_email_consent, VALUES(offer_email_consent)),
         whatsapp_followup_consent = GREATEST(whatsapp_followup_consent, VALUES(whatsapp_followup_consent)),
         updated_at = NOW()`,
      [
        email, userId, customerName,
        input.consent.cartReminder ? 1 : 0,
        input.consent.offerEmail ? 1 : 0,
        input.consent.whatsappFollowup ? 1 : 0,
        input.consent.cartReminder ? 1 : 0,
        input.consent.offerEmail ? 1 : 0,
        input.consent.whatsappFollowup ? 1 : 0,
      ]
    );

    if (input.consent.cartReminder) {
      await connection.execute(
        `UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'Replaced by newer checkout activity', updated_at = NOW()
         WHERE email = ? AND status = 'pending'`,
        [email]
      );
      await connection.execute(
        `INSERT INTO cart_reminder_jobs
          (email, user_id, customer_name, items, items_subtotal, activity_at, due_at, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? HOUR), 'pending', ?)`,
        [email, userId, customerName, JSON.stringify(pricedItems), itemsSubtotal, CART_REMINDER_DELAY_HOURS, idempotencyKey]
      );
    }
  });

  return { saved: true, reminderScheduled: input.consent.cartReminder };
};

export const issueUnsubscribeUrl = async (email: string) => {
  const normalized = normalizeCustomerEmail(email);
  const token = randomBytes(32).toString('hex');
  const tokenHash = hash(token);
  await dbExecute('INSERT INTO email_unsubscribe_tokens (token_hash, email) VALUES (?, ?)', [tokenHash, normalized]);
  // Store the bearer token in the URL fragment: browsers do not send fragments
  // in HTTP requests or Referer headers.
  return `${publicBaseUrl()}/email/unsubscribe#token=${encodeURIComponent(token)}`;
};

export const unsubscribeEmail = async (tokenValue: unknown) => {
  const token = String(tokenValue || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return false;
  const tokenHash = hash(token.toLowerCase());
  return withDbTransaction(async (connection) => {
    const [tokenRows] = await connection.execute(
      'SELECT email FROM email_unsubscribe_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE',
      [tokenHash]
    );
    const email = (tokenRows as any[])[0]?.email;
    if (!email) return false;
    await connection.execute('UPDATE email_contact_preferences SET cart_reminder_consent = 0, offer_email_consent = 0, whatsapp_followup_consent = 0, updated_at = NOW() WHERE email = ?', [email]);
    await connection.execute(
      `UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'Customer unsubscribed', updated_at = NOW()
       WHERE email = ? AND status IN ('pending', 'sending')`,
      [email]
    );
    await connection.execute(
      `UPDATE offer_email_deliveries SET status = 'cancelled', last_error = 'Customer unsubscribed', updated_at = NOW()
       WHERE email = ? AND status IN ('pending', 'sending')`,
      [email]
    );
    await connection.execute('UPDATE email_unsubscribe_tokens SET used_at = COALESCE(used_at, NOW()) WHERE token_hash = ?', [tokenHash]);
    return true;
  });
};

const markReminderUncertainOrRetry = async (job: any, error: unknown) => {
  const safeMessage = error instanceof EmailProviderResponseError
    ? `Email provider returned HTTP ${error.status}`
    : 'Email provider outcome could not be confirmed';
  const providerRejected = error instanceof EmailProviderResponseError && error.status >= 400 && error.status < 500 && error.status !== 409;
  if (providerRejected && Number(job.attempts) < MAX_ATTEMPTS) {
    await dbExecute(
      `UPDATE cart_reminder_jobs
       SET status = 'pending', due_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), last_error = ?, updated_at = NOW()
       WHERE id = ? AND status = 'sending'`,
      [EMAIL_RETRY_MINUTES * Math.max(1, Number(job.attempts)), safeMessage, job.id]
    );
    return;
  }
  const status = providerRejected ? 'failed' : 'uncertain';
  await dbExecute(
    'UPDATE cart_reminder_jobs SET status = ?, last_error = ?, updated_at = NOW() WHERE id = ? AND status = \'sending\'',
    [status, safeMessage, job.id]
  );
};

const hasCompletedOrderSinceActivity = async (job: any) => {
  const rows = await dbQuery<any>(
    `SELECT o.id
       FROM orders o
      WHERE LOWER(o.customer_email) = ?
        AND o.created_at >= ?
        AND (
          LOWER(COALESCE(o.status, '')) IN ('confirmed','processing','shipped','delivered')
          OR EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND LOWER(p.status) = 'paid')
          OR EXISTS (SELECT 1 FROM payment_status ps WHERE ps.order_id = o.id AND LOWER(ps.status) = 'paid')
        )
      LIMIT 1`,
    [normalizeCustomerEmail(job.email), job.activity_at]
  );
  return Boolean(rows.length);
};

const findPendingPaymentOrder = async (job: any) => {
  const rows = await dbQuery<any>(
    `SELECT o.id AS order_id, o.customer_name, o.items, o.total, ps.amount, ps.token
       FROM orders o
       JOIN payment_status ps ON ps.order_id = o.id
      WHERE LOWER(o.customer_email) = ?
        AND o.created_at >= ?
        AND LOWER(COALESCE(ps.method, '')) = 'razorpay'
        AND LOWER(COALESCE(ps.status, '')) = 'pending'
        AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'failed', 'refunded')
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 1`,
    [normalizeCustomerEmail(job.email), job.activity_at]
  );
  const row = rows[0];
  if (!row?.token || !row?.order_id) return null;
  return row;
};

const claimReminder = async (id: number) => {
  const result: any = await dbExecute(
    `UPDATE cart_reminder_jobs
        SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = NOW()
      WHERE id = ? AND status = 'pending' AND due_at <= NOW() AND attempts < ?`,
    [id, MAX_ATTEMPTS]
  );
  if (!result.affectedRows) return null;
  const rows = await dbQuery<any>('SELECT * FROM cart_reminder_jobs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

const processReminder = async (candidate: any) => {
  const job = await claimReminder(Number(candidate.id));
  if (!job) return;

  try {
    if (await hasCompletedOrderSinceActivity(job)) {
      await dbExecute("UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'A completed order was found' WHERE id = ? AND status = 'sending'", [job.id]);
      return;
    }

    const pendingPayment = await findPendingPaymentOrder(job);
    let cartSummary: { items: any[]; subtotal: number } | null = null;
    if (!pendingPayment) {
      const originalItems = parseJson<any[]>(job.items, []);
      const priced = await priceAndValidateOrderItems(originalItems);
      if (!priced.ok || !priced.items.length) {
        await dbExecute("UPDATE cart_reminder_jobs SET status = 'failed', last_error = 'Cart could not be revalidated' WHERE id = ? AND status = 'sending'", [job.id]);
        return;
      }
      cartSummary = { items: priced.items, subtotal: priced.itemsSubtotal };
    } else if (!parseJson<any[]>(pendingPayment.items, []).length) {
      await dbExecute("UPDATE cart_reminder_jobs SET status = 'failed', last_error = 'Pending order details are unavailable' WHERE id = ? AND status = 'sending'", [job.id]);
      return;
    }

    const unsubscribeUrl = await issueUnsubscribeUrl(job.email);
    // This is the message authorization point. After the transaction commits,
    // a later order or unsubscribe cannot recall a provider request already
    // authorized here; the final gap to Resend is an external-system boundary.
    const authorized = await withDbTransaction(async (connection) => {
      const [preferenceRows] = await connection.execute(
        'SELECT cart_reminder_consent FROM email_contact_preferences WHERE email = ? LIMIT 1 FOR UPDATE',
        [job.email]
      );
      if (!Number((preferenceRows as any[])[0]?.cart_reminder_consent)) {
        await connection.execute("UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'Consent is not active' WHERE id = ?", [job.id]);
        return false;
      }
      const [jobRows] = await connection.execute('SELECT status FROM cart_reminder_jobs WHERE id = ? FOR UPDATE', [job.id]);
      if ((jobRows as any[])[0]?.status !== 'sending') return false;
      return true;
    });
    if (!authorized) return;
    const dispatchState = await dbQuery<any>('SELECT status FROM cart_reminder_jobs WHERE id = ? LIMIT 1', [job.id]);
    if (dispatchState[0]?.status !== 'sending') return;
    if (await hasCompletedOrderSinceActivity(job)) {
      await dbExecute("UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'A completed order was found' WHERE id = ? AND status = 'sending'", [job.id]);
      return;
    }

    const idempotencyKey = `cart-reminder-${job.id}-${job.idempotency_key.slice(0, 24)}`;
    if (pendingPayment) {
      await sendPendingPaymentReminderEmail(job.email, {
        customerName: pendingPayment.customer_name || job.customer_name,
        orderId: String(pendingPayment.order_id),
        items: parseJson<any[]>(pendingPayment.items, []),
        amountDue: Number(pendingPayment.amount ?? pendingPayment.total ?? 0),
        paymentUrl: `${publicBaseUrl()}/payment-status/${encodeURIComponent(String(pendingPayment.token))}`,
        unsubscribeUrl,
        idempotencyKey,
      });
      await dbExecute("UPDATE cart_reminder_jobs SET status = 'sent', last_error = NULL, updated_at = NOW() WHERE id = ? AND status = 'sending'", [job.id]);
    } else if (cartSummary) {
      await sendCartReminderEmail(job.email, {
        customerName: job.customer_name,
        items: cartSummary.items,
        itemsSubtotal: cartSummary.subtotal,
        unsubscribeUrl,
        idempotencyKey,
      });
      await dbExecute("UPDATE cart_reminder_jobs SET status = 'sent', items = ?, items_subtotal = ?, last_error = NULL, updated_at = NOW() WHERE id = ? AND status = 'sending'", [JSON.stringify(cartSummary.items), cartSummary.subtotal, job.id]);
    }
  } catch (error) {
    await markReminderUncertainOrRetry(job, error);
  }
};

const offerDescription = (coupon: any) => {
  const pieces = [
    Number(coupon.discount_value) > 0
      ? `${Number(coupon.discount_value).toLocaleString('en-IN')}${coupon.discount_type === 'percent' ? '% off' : ' off'}`
      : '',
    Number(coupon.max_discount) > 0 ? `up to ₹${Number(coupon.max_discount).toLocaleString('en-IN')}` : '',
    Number(coupon.free_shipping) ? 'free shipping' : '',
    Number(coupon.free_packaging) ? 'free packaging' : '',
    Number(coupon.min_order_amount) > 0 ? `on orders above ₹${Number(coupon.min_order_amount).toLocaleString('en-IN')}` : '',
    coupon.scope_type && coupon.scope_type !== 'all' ? `on selected ${coupon.scope_type}s` : '',
  ].filter(Boolean);
  return pieces.join(' · ') || 'Enjoy this special offer at BrajMart.';
};

const claimOfferDelivery = async (id: number) => {
  const result: any = await dbExecute(
    "UPDATE offer_email_deliveries SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = NOW() WHERE id = ? AND status = 'pending'",
    [id]
  );
  if (!result.affectedRows) return null;
  const rows = await dbQuery<any>(
    `SELECT d.*, c.updated_at AS coupon_updated_at, c.code, c.title, c.discount_type, c.discount_value, c.max_discount,
            c.free_shipping, c.free_packaging, c.min_order_amount, c.scope_type, c.starts_at, c.ends_at, c.is_active, c.archived_at
       FROM offer_email_deliveries d JOIN coupons c ON c.id = d.coupon_id WHERE d.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const processOfferDelivery = async (candidate: any) => {
  const delivery = await claimOfferDelivery(Number(candidate.id));
  if (!delivery) return;
  try {
    if (getCouponCampaignKey({ ...delivery, updated_at: delivery.coupon_updated_at }) !== String(delivery.campaign_key)) {
      await dbExecute("UPDATE offer_email_deliveries SET status = 'cancelled', last_error = 'Offer changed after campaign was queued' WHERE id = ? AND status = 'sending'", [delivery.id]);
      return;
    }
    const now = Date.now();
    const startsAt = delivery.starts_at ? new Date(delivery.starts_at).getTime() : 0;
    const endsAt = delivery.ends_at ? new Date(delivery.ends_at).getTime() : 0;
    if (!Number(delivery.is_active) || delivery.archived_at || (startsAt && startsAt > now) || (endsAt && endsAt < now)) {
      await dbExecute("UPDATE offer_email_deliveries SET status = 'cancelled', last_error = 'Offer is not currently active' WHERE id = ? AND status = 'sending'", [delivery.id]);
      return;
    }
    const unsubscribeUrl = await issueUnsubscribeUrl(delivery.email);
    const authorized = await withDbTransaction(async (connection) => {
      const [preferenceRows] = await connection.execute(
        'SELECT offer_email_consent FROM email_contact_preferences WHERE email = ? LIMIT 1 FOR UPDATE',
        [delivery.email]
      );
      if (!Number((preferenceRows as any[])[0]?.offer_email_consent)) {
        await connection.execute("UPDATE offer_email_deliveries SET status = 'cancelled', last_error = 'Offer email consent is not active' WHERE id = ?", [delivery.id]);
        return false;
      }
      const [deliveryRows] = await connection.execute('SELECT status FROM offer_email_deliveries WHERE id = ? FOR UPDATE', [delivery.id]);
      return (deliveryRows as any[])[0]?.status === 'sending';
    });
    if (!authorized) return;
    const dispatchState = await dbQuery<any>('SELECT status FROM offer_email_deliveries WHERE id = ? LIMIT 1', [delivery.id]);
    if (dispatchState[0]?.status !== 'sending') return;
    await sendCouponOfferEmail(delivery.email, {
      customerName: delivery.customer_name,
      code: delivery.code,
      title: delivery.title || undefined,
      description: offerDescription(delivery),
      validUntil: delivery.ends_at,
      unsubscribeUrl,
      idempotencyKey: `offer-${delivery.idempotency_key}`,
    });
    await dbExecute("UPDATE offer_email_deliveries SET status = 'sent', last_error = NULL, updated_at = NOW() WHERE id = ? AND status = 'sending'", [delivery.id]);
  } catch (error) {
    const rejected = error instanceof EmailProviderResponseError && error.status >= 400 && error.status < 500 && error.status !== 409;
    const message = error instanceof EmailProviderResponseError
      ? `Email provider returned HTTP ${error.status}`
      : 'Email provider outcome could not be confirmed';
    await dbExecute(
      'UPDATE offer_email_deliveries SET status = ?, last_error = ?, updated_at = NOW() WHERE id = ? AND status = \'sending\'',
      [rejected ? 'failed' : 'uncertain', message, delivery.id]
    );
  }
};

let schedulerStarted = false;
let schedulerRunning = false;

export const shouldStartCartReminderScheduler = (env: NodeJS.ProcessEnv = process.env) =>
  String(env.EMAIL_FOLLOWUPS_WORKER_ENABLED || '').trim().toLowerCase() === 'true';

export const isFollowupEmailProviderConfigured = (env: NodeJS.ProcessEnv = process.env) =>
  String(env.EMAIL_PROVIDER || '').trim().toLowerCase() === 'resend'
  && Boolean(String(env.RESEND_API_KEY || '').trim())
  && Boolean(String(env.EMAIL_FROM || '').trim());

export const startCartReminderScheduler = () => {
  if (schedulerStarted || !shouldStartCartReminderScheduler()) return;
  schedulerStarted = true;
  const run = async () => {
    if (schedulerRunning || !isDbConnected()) return;
    if (!isFollowupEmailProviderConfigured()) {
      console.error('Cart follow-up worker is enabled but Resend idempotent delivery is not configured');
      return;
    }
    schedulerRunning = true;
    try {
      await dbExecute(
        `UPDATE cart_reminder_jobs
            SET status = 'uncertain',
                last_error = 'Worker interrupted during provider submission; manual reconciliation required', updated_at = NOW()
          WHERE status = 'sending' AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [STALE_SEND_MINUTES]
      );
      await dbExecute(
        `UPDATE offer_email_deliveries
            SET status = 'uncertain', last_error = 'Worker interrupted during provider submission', updated_at = NOW()
          WHERE status = 'sending' AND updated_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [STALE_SEND_MINUTES]
      );
      const reminderRows = await dbQuery<any>(
        `SELECT id FROM cart_reminder_jobs WHERE status = 'pending' AND due_at <= NOW() AND attempts < ? ORDER BY due_at, id LIMIT 10`,
        [MAX_ATTEMPTS]
      );
      for (const row of reminderRows) await processReminder(row);

      const offerRows = await dbQuery<any>(
        "SELECT id FROM offer_email_deliveries WHERE status = 'pending' ORDER BY id LIMIT 10"
      );
      for (const row of offerRows) await processOfferDelivery(row);
    } catch (error) {
      void error;
      console.error('Cart follow-up worker batch failed; inspect database and email-provider health without logging recipient data');
    } finally {
      schedulerRunning = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), RUN_INTERVAL_MS);
  timer.unref?.();
};

export const cancelCartRemindersForOrder = async (emailValue: unknown) => {
  const email = normalizeCustomerEmail(emailValue);
  if (!isValidCustomerEmail(email)) return;
  await dbExecute(
    `UPDATE cart_reminder_jobs SET status = 'cancelled', last_error = 'Order completed', updated_at = NOW()
     WHERE email = ? AND status IN ('pending', 'sending')`,
    [email]
  );
};
