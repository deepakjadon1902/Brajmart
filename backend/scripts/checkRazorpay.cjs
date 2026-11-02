const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { inspectRazorpayConfiguration } = require('../src/lib/razorpayEnvironment');

// Configuration only: no database access, gateway requests, orders, payments,
// webhooks or email. Exported service variables take precedence over .env.
const report = inspectRazorpayConfiguration();
console.log(JSON.stringify(report, null, 2));
if (!report.checkoutReady || !report.webhookReady) process.exitCode = 1;
