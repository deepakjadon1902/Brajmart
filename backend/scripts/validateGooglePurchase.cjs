// Validates a synthetic payload without recording an Analytics event or touching orders.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

async function main() {
  const envFile = path.resolve(__dirname, '..', '.env');
  const saved = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const measurementId = String(process.env.GA4_MEASUREMENT_ID || saved.GA4_MEASUREMENT_ID || '').trim();
  const secret = String(process.env.GA4_API_SECRET || saved.GA4_API_SECRET || '').trim();
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || !secret || /\s/.test(secret)) {
    console.error('GA4 measurement ID or backend API secret is missing or malformed.');
    process.exitCode = 1;
    return;
  }
  const { buildGooglePurchaseParams } = require('../dist/lib/googlePurchases');
  const params = buildGooglePurchaseParams({
    id: 'local-validation-only', total: 159, coupon_discount: 10,
    items: [{ id: 'validation-item', name: 'Validation item', price: 100, quantity: 1 }],
  });
  if (!params) throw new Error('Could not build validation fixture');
  const now = Date.now();
  const payload = {
    client_id: '123456789.1234567890', timestamp_micros: now * 1000,
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    validation_behavior: 'ENFORCE_RECOMMENDATIONS',
    events: [{ name: 'purchase', params: { ...params, session_id: Math.floor(now / 1000), engagement_time_msec: 1 } }],
  };
  // Never use the production /mp/collect endpoint for this fixture.
  const url = new URL('https://www.google-analytics.com/debug/mp/collect');
  url.searchParams.set('measurement_id', measurementId);
  url.searchParams.set('api_secret', secret);
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error(`Google validation endpoint returned HTTP ${response.status}.`);
    process.exitCode = 1;
    return;
  }
  const data = await response.json();
  if (!Array.isArray(data.validationMessages)) throw new Error('Unexpected validation response');
  const messages = data.validationMessages.map((entry) => ({
    fieldPath: String(entry.fieldPath || '').slice(0, 160),
    validationCode: String(entry.validationCode || '').slice(0, 100),
    description: String(entry.description || '').split(secret).join('[redacted]').slice(0, 500),
  }));
  console.log(JSON.stringify({ measurementId, validationMessages: messages, purchaseRecorded: false,
    note: 'Google validates payload structure here, not API-secret ownership or production delivery.' }, null, 2));
  if (messages.length) process.exitCode = 1;
}

main().catch(() => {
  // Network errors may contain the request URL. Never log it with the secret.
  console.error('Google payload validation failed. Check connectivity and build the backend first. No purchase was recorded.');
  process.exitCode = 1;
});
