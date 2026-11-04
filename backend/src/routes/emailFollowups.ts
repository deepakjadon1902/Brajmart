import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { rateLimit, rateLimitKeyByIpAndEmail } from '../middleware/rateLimit';
import { captureEmailFollowup, FollowupValidationError, isValidCustomerEmail, normalizeCustomerEmail, unsubscribeEmail } from '../lib/cartFollowups';

const router = Router();
const captureLimiter = rateLimit('email-followup-capture', {
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: rateLimitKeyByIpAndEmail('email'),
  message: 'Too many email preference updates. Please try again later.',
});
const unsubscribeLimiter = rateLimit('email-followup-unsubscribe', {
  windowMs: 15 * 60 * 1000,
  max: 20,
});

router.post('/capture', captureLimiter, optionalAuth, async (req: any, res) => {
  try {
    const email = normalizeCustomerEmail(req.body?.email);
    if (!isValidCustomerEmail(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    const consent = {
      cartReminder: req.body?.consent?.cartReminder === true,
      offerEmail: req.body?.consent?.offerEmail === true,
      whatsappFollowup: req.body?.consent?.whatsappFollowup === true,
    };
    const revokeCartReminder = req.body?.revokeCartReminder === true;
    if (!consent.cartReminder && !consent.offerEmail && !consent.whatsappFollowup && !revokeCartReminder) {
      return res.status(400).json({ message: 'Select at least one optional contact preference' });
    }

    const result = await captureEmailFollowup({
      email,
      customerName: String(req.body?.customerName || '').trim(),
      userId: req.user?.id ? String(req.user.id) : null,
      items: Array.isArray(req.body?.items) ? req.body.items : [],
      consent,
      revokeCartReminder,
      reminderSource: req.body?.reminderSource === 'saved_products' ? 'saved_products' : 'checkout',
      favoriteItems: Array.isArray(req.body?.favoriteItems) ? req.body.favoriteItems : [],
    });
    res.json({ saved: result.saved, reminderScheduled: result.reminderScheduled });
  } catch (error) {
    if (error instanceof FollowupValidationError) return res.status(400).json({ message: error.message });
    res.status(503).json({ message: 'Could not save email preferences right now. Checkout can continue.' });
  }
});

router.post('/unsubscribe', unsubscribeLimiter, async (req, res) => {
  try {
    const unsubscribed = await unsubscribeEmail(req.body?.token);
    if (!unsubscribed) return res.status(400).json({ message: 'This unsubscribe link is invalid. Please contact BrajMart support.' });
    res.json({ ok: true, message: 'You have been unsubscribed from BrajMart cart reminders, offer emails, and WhatsApp follow-ups.' });
  } catch {
    res.status(503).json({ message: 'We could not update your preferences right now. Please try again.' });
  }
});

export default router;
