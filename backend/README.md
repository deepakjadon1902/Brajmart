# BrajMart Backend

Node.js + Express + MySQL backend for BrajMart e-commerce platform.

## Setup

1. Copy `.env.example` to `.env` and add your MySQL credentials and JWT secret
2. Run `npm install`
3. (Optional for local testing) Create `uploads/` directory: `mkdir uploads`
4. Add ImageKit credentials to `.env` if you want permanent deployed image storage.
5. Run `npm run dev` (development) or `npm start` (production)

## Product GST and invoice breakdown

Apply the reviewed `sql/migrate_products_invoice_tax.sql` to an existing
database before using the new admin tax fields. It adds nullable `hsn_code`,
`unit`, and `gst_rate` columns, preserves existing data, and can be rerun.
Application startup and requests do not execute the migration. New databases
include these columns in `sql/hostinger_schema.sql`.

In **Admin > Products > Add/Edit > Invoice & GST**, enter each product's HSN
(4, 6 or 8 digits), unit (for example PCS, SET or KG), and GST percentage.
Rates are entered manually, accept up to two decimal places, and are not
inferred from HSN. An explicit 0 is a zero rate; blank means not configured.
Selling prices already include GST, so this feature does not add tax to the
customer's checkout total or reuse the global packaging percentage as GST.

COD, Razorpay, and PayU checkout snapshot these fields from the database,
ignoring client-supplied tax values. New product edits affect future orders.
Existing order invoices retain their saved values; historical missing HSN,
unit or GST appears as unavailable rather than using today's catalog rates.

Single and bulk PDFs show Product (with SKU/variants), HSN, Unit, Qty, Rate,
Taxable, GST %, IGST or CGST+SGST, and Price. Rate is the GST-inclusive unit
price; Price is the line amount after any product discount. Taxable value is
the discounted line amount divided by `(1 + GST / 100)`, rounded to paise;
included tax is the remainder. A saved coupon allocation preserves product or
category eligibility and distributes rounding paise deterministically.
Free shipping/packaging coupon benefits do not reduce product taxable value.
Shipping, packaging and COD retain their saved charges separately; the GST
breakdown shown is for products, without inventing tax rates for these fees.

The existing seller GSTIN starts with 09 (Uttar Pradesh). Delivery to Uttar
Pradesh uses CGST/SGST, split to paise; other recognised Indian delivery states
use IGST. The delivery state and code appear as Place of Supply. A taxable
invoice with an unrecognised delivery state returns a validation error instead
of guessing the tax type. Partial legacy GST information is shown on the lines
without presenting an incomplete tax summary as a complete one.

For example, a GST-inclusive rate of INR 219 at 5% gives INR 208.57 taxable
value and INR 10.43 included GST; with INR 49 shipping the total remains
INR 268. Reference: [CBIC Rule 35, inclusive tax valuation](https://cbic-gst.gov.in/pdf/01062021-CGST-Rules-2017-Part-A-Rules.pdf)
and [CBIC, interstate and intrastate supplies](https://cbic-gst.gov.in/pdf/e-version-igst-fliers/eflier-IGST-23062017.pdf).

## Admin order and invoice filters

`GET /api/orders`, `GET /api/orders/admin/invoices`, and
`GET /api/orders/admin/invoices.zip` share optional query filters:
`search`, `customer` (customer name), `status` (comma-separated order statuses),
`dateFrom`, and `dateTo` (`YYYY-MM-DD`). Date bounds use India time
(`Asia/Kolkata`), include the entire final day, and support either bound alone.
Invalid dates, reversed ranges and unknown statuses return HTTP 400.

The admin Orders page applies these filters to the table, Excel export and
invoice folder/ZIP downloads across all pages. Clear filters to export all
visible merchant orders. Each PDF filename includes the customer name, order
date in India, and order ID, such as
`Bikram Paul - 2026-10-14 - Invoice-10339.pdf`. No schema migration is needed.

## Shipping partners

Admin Orders supports DTDC, Delhivery, Shree Maruti, India Post, Ekart,
Shadowfax and Amazon Shipping. Existing databases need the reviewed
`sql/add_shadowfax_shipping_service.sql` followed by
`sql/add_amazon_shipping_service.sql` when their `orders.shipping_service` ENUM
does not yet include these couriers. These changes append values and preserve
the existing couriers and their ENUM indexes; they do not run automatically on
requests or application startup. Do not rerun the older Shadowfax migration
after applying the Amazon Shipping migration.

Shipping labels preserve the selected courier and saved AWB. Dispatch messages
link to the courier's official tracking page and include the AWB separately.
The labels service supports Shadowfax status sync; Amazon Shipping live status
sync requires an Amazon tracking adapter and credentials in that service.

## Live admin analytics

`GET /api/analytics?period=daily` (also `weekly`, `monthly`, `quarterly`,
`yearly`) returns `periodSummary` for the selected period and retains `allTime`
for the lifetime revenue card. The status and charges sections follow the
Daily/Weekly/Monthly/Quarterly/Yearly buttons. Date ranges use India time
(`Asia/Kolkata`): today, this week starting Monday, this calendar month,
this calendar quarter, or this calendar year, from midnight through the latest
refresh. Order counts, statuses, saved charges and outstanding COD use the
order creation date. Collected revenue uses the recorded payment date, including
payments received in the period for earlier orders. Charts use the same India
calendar boundaries. The admin page refreshes the database report every
15 seconds while visible, on returning to the page, and
with the Refresh button. Failed refreshes retain the last report and display
an error until a fresh request succeeds. Responses disable caching.

Financial totals use saved order values, product subtotals, shipping charges,
packaging charges, COD fees and discounts, including cancelled/RTO orders.
These are customer order charges. Historical missing shipping/packaging/COD
amounts are counted as missing, not estimated from current checkout settings.
Legacy product subtotals can be recovered from saved item prices and quantities.

Collected revenue includes one latest recorded paid payment per order. The
`payments` ledger takes precedence over its `payment_status` mirror, avoiding
duplicate collections and stale paid flags after a refund. Unpaid COD is
excluded from revenue; COD awaiting collection excludes cancelled, RTO and
refunded orders. Paid COD uses the existing admin **Mark collected** action.
No schema migration is needed.

## Render production TypeScript builds

This backend compiles during `postinstall`. With `NODE_ENV=production`, npm
omits development dependencies by default. The compiler and every external
declaration package needed by `src` therefore belong in `dependencies` for
this install-and-build lifecycle. `nodemon` remains a development dependency.
Keep these declarations in the production installation even though they do
not execute at runtime; otherwise installation fails before the server starts.

The lockfile retains Express 4 and its compatible Express 4 declarations.
Missing Express declarations cause follow-on errors in `AuthRequest.body`,
`params`, `query`, and inferred handler parameters. Do not fix these by adding
declaration shims, weakening strict checking, or changing production runtime
mode. `AuthRequest` extends the actual Express `Request` and preserves the
existing optional authenticated-user fields.

For a reviewed Render release, the service root is `backend`; `npm ci --omit=dev`
installs the locked production dependencies and runs the existing build hook.
`npm start` runs `dist/index.js`. No Render environment changes are required
for this fix. Local verification commands are:

```sh
npm install --include=dev
npm run typecheck
npm run build
npm test
npm run test:integration
```

`typecheck` includes compilation-only Express request contracts. Integration
tests use loopback HTTP servers and in-memory persistence doubles. The older
`phase*Smoke.ts` scripts insert/delete database records and must not be pointed
at production as part of build verification.

## Razorpay checkout environment on Render

`Razorpay production environment mismatch` originates in this backend before
it contacts Razorpay. For the live storefront, configure **all three** settings
in **Render → Brajmart-1 → Environment**:

```env
APP_ENV=production
NODE_ENV=production
RAZORPAY_MODE=live
```

Keep the existing `RAZORPAY_PLATFORM_KEY_ID` (a live `rzp_live_` ID), its paired
`RAZORPAY_PLATFORM_KEY_SECRET`, and `RAZORPAY_PLATFORM_WEBHOOK_SECRET` on that
backend service. Remove or empty every `RAZORPAY_TEST_*` variable there.
Production rejects missing mode flags, test credentials and a mixed environment;
these checks must remain enabled. A local `.env` edit or Vercel frontend setting
does not update Render. After reviewing these changes, apply the matching Render
environment settings and restart/deploy the backend through the normal release
process.

Run `npm run check:razorpay` in the backend directory (or Render Shell) to list
the exact settings that need attention. It only inspects configuration: no
database access, gateway requests, orders, payments or emails. It logs setting
names and fixed instructions, never key IDs or secrets; it does not authenticate
the keys with Razorpay. Exit code 0 means both checkout and webhook configuration
are complete. Startup also reports configuration problems before customers
attempt payment. Checkout returns a customer-safe HTTP 503 while misconfigured,
without creating an order or reserving inventory.

If this check passes but an already-running local checkout returns
`PAYMENT_UNAVAILABLE`, restart the backend or enter `rs` in its nodemon terminal.
The check is a new process; an older server retains the settings it read at
startup. The development command watches both `src` and `.env`, so subsequent
environment edits restart the API automatically. A server started with an older
development command needs one restart to adopt the updated watch list. Successful
startup logs `Razorpay environment checks passed` with the mode and webhook
readiness only; this validates configuration, not provider authentication.

For staging use `APP_ENV=staging`, `NODE_ENV=production`, `RAZORPAY_MODE=test`,
and only `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, and
`RAZORPAY_TEST_WEBHOOK_SECRET`. Local test payments use `APP_ENV=development`,
`NODE_ENV=development`, and the same dedicated test variables. Never copy live
credentials into the staging or development credential namespace.

Reference: [Razorpay API keys and Test/Live modes](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys).

## PayU hosted checkout

The online checkout uses PayU's hosted payment page, so PayU collects payment
details and card or UPI secrets stay on PayU. The backend creates the SHA-512
request hash, receives PayU's form-post callback, validates its reverse hash,
then confirms a successful payment against PayU's Verify Payment API before
marking the order paid.

Configure these backend environment variables with the merchant credentials
from PayU:

```env
PAYU_KEY=your_merchant_key
PAYU_SALT=your_merchant_salt
PAYU_ENV=test
PAYU_CALLBACK_URL=https://your-public-api.example.com/api/payu/callback
```

Use `PAYU_ENV=test` for development/staging and `PAYU_ENV=live` for production.
If left empty, the backend infers live only when both `APP_ENV` and `NODE_ENV`
are `production`; otherwise it uses test mode. The callback URL must be public
and reachable by PayU. `BACKEND_URL` can provide the backend origin instead of
`PAYU_CALLBACK_URL`. Restart/redeploy the backend after setting the credentials.
Do not expose the merchant salt in the frontend or include it in the hosted
checkout form.

References: [PayU Hosted Checkout](https://docs.payu.in/docs/prebuilt-checkout-page-integration),
[PayU request and response hashing](https://docs.payu.in/docs/hashing-request-and-response),
and [PayU Verify Payment API](https://docs.payu.in/reference/verify_payment_api).

## Vercel frontend CORS on Render

`CORS blocked origin` means the running backend does not allow the URL opened
in the browser. Configure the backend service's **Environment** settings on
Render; changing a local `.env` does not change that service's environment.
For the BrajMart Vercel project shown in the deployment logs, use:

```env
FRONTEND_URL=https://www.brajmart.com
SITE_URL=https://www.brajmart.com
CORS_ORIGIN=https://www.brajmart.com,https://brajmart.com
CORS_VERCEL_PROJECT=brajmart
CORS_VERCEL_SCOPE=itbrajmarts-projects
```

The optional Vercel settings must both be set. They allow HTTPS deployment URLs
such as `https://brajmart-cv48hs1e2-itbrajmarts-projects.vercel.app` and branch
aliases such as `https://brajmart-git-main-itbrajmarts-projects.vercel.app`.
Use the project and scope slugs from your own deployment URL. Other Vercel
projects and scopes are rejected. To allow only specific deployments instead,
leave these two settings empty and append their exact origins to `CORS_ORIGIN`.

After deploying this backend change, save and deploy the environment settings.
Render's **Save, rebuild, and deploy** option also builds updated source.
`FRONTEND_URL` and `SITE_URL` each take one URL; only `CORS_ORIGIN` takes a
comma-separated list. Valid configured origins are normalized to handle a
trailing slash or a default port. A denied browser origin returns HTTP 403.

With `APP_ENV=staging`, only exact HTTPS origins in `CORS_ORIGIN` are accepted;
the Vercel settings do not broaden staging access. Include the staging
`FRONTEND_URL` in that list and use a staging `SITE_URL`.

The frontend's build-time catalog requests do not send a browser `Origin`
header, so a CORS rejection alone does not diagnose a Vercel build failure.
Set an absolute `BUILD_API_BASE_URL` or `API_BASE_URL` in Vercel for prerendering
(for example `https://your-backend.onrender.com/api`) and inspect the final
build error if the build fails. Relative `/api` is not a build-time backend URL.

References: [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls)
and [Render environment variables](https://render.com/docs/configure-environment-variables).

## Catalog HTTP 500 and prerender failures

If `/api/health` returns 200 but `/api/products` or `/api/categories` returns
`Runtime database DDL is disabled`, deploy the updated backend first. The old
catalog handlers attempted `CREATE TABLE IF NOT EXISTS` on requests, which the
runtime database guard rejects even when the table already exists. Product and
category routes now use the existing schema without automatic DDL or category
backfills. The guard remains enabled, and genuinely missing schema still fails.

Schema changes and backfills belong in the reviewed migrations in `backend/sql`,
not in web requests. Product variant saves retain their missing-column checks
and return the existing migration instructions instead of attempting `ALTER`.
After deploying the backend, verify both catalog endpoints return their normal
JSON arrays before rerunning the Vercel frontend build.

## Cart reminders and offer emails

This feature uses BrajMart's existing application MySQL database. The owner-run,
reviewed schema change is `backend/sql/migrate_email_followups.sql`; it creates
preference and queue tables only. It does not copy or enroll existing customer
data. The runtime migration implementation is in `src/lib/migrations.ts` and
remains subject to the existing guarded migration policy; application startup
does not apply it automatically.

Before enabling the worker, apply the reviewed SQL to the intended application
database after verifying its identity and backup. Configure the existing email
provider with `EMAIL_PROVIDER=resend`, a valid `RESEND_API_KEY`, a verified
`EMAIL_FROM`, and the production `FRONTEND_URL`. Then set
`EMAIL_FOLLOWUPS_WORKER_ENABLED=true` on the backend. The worker polls persistent
database queues once per minute. Cart reminders become eligible three hours after
the customer's last saved checkout activity with an explicit opt-in and valid
email address. Preferences and cart details are saved while filling checkout,
before the address or payment step is submitted. Continuing to payment reuses
the saved request, so it does not enqueue a duplicate reminder. Unchecking the
cart-reminder choice cancels its queued messages. Save failures display a retry
action without blocking checkout. Unsent, unattempted jobs from the former
four-hour schedule move to three hours on the next worker batch; existing retry
backoff and uncertain outcomes remain unchanged. Pending jobs survive
process restarts and are picked up afterward, but delivery can be delayed while
a Render service is asleep or unavailable. A job interrupted during provider
submission is marked uncertain and is not automatically resent, avoiding a
possible duplicate at the cost of requiring manual review for that rare case.

The cart and wishlist pages also offer an unchecked email reminder for saved
products, without requiring checkout. This explicitly records the broader
`saved-products-v1` preference; existing checkout-only consent does not enroll
favorites. One combined email becomes eligible after three hours and includes
separate cart/favorites summaries, current catalog names, options, quantities,
prices and links to proceed with the order. Favorites already in the cart are
omitted from the favorites section. Item subtotals exclude checkout charges.
The worker removes unavailable products and reloads the latest account cart and
wishlist before sending. For guests, it revalidates the saved browser snapshot;
an email address and opt-in are required. Saved items remain tied to the same
browser/account, and individual product links support returning on another device.

After this opt-in, account cart and wishlist changes update the persistent
three-hour reminder queue, including when a later browser session has no open
reminder form. Identical account snapshots do not queue another email, and an
active checkout/payment reminder takes precedence. Removing all saved products,
withdrawing consent or completing an order cancels pending reminders. This uses
the existing queue JSON and requires no additional schema migration.

To diagnose a worker batch failure, run `npm run check:email-followups` from
`backend` with the same environment as the server. This command reads schema
metadata only: it does not read recipient records, update jobs, run migrations,
or send emails. It reports provider configuration, database connectivity, and
the exact missing follow-up tables, columns, or queue statuses. Provider
configuration being present does not prove that the sender is verified.

The worker checks the follow-up schema before modifying either queue. Missing
schema reports `EMAIL_FOLLOWUP_SCHEMA_INCOMPLETE` with the affected table names;
review `sql/migrate_email_followups.sql` against the intended database. Existing
partial tables need a reviewed repair for the named columns/statuses because
`CREATE TABLE IF NOT EXISTS` does not alter an existing table. Database failures
report a safe code (for example `ETIMEDOUT` or `ER_TABLEACCESS_DENIED_ERROR`) and
the batch stage instead of raw SQL, credentials or recipient details. The next
scheduled batch retries automatically after the underlying problem is repaired.

If this check times out with a literal IPv6 `DB_HOST`, verify the MySQL server
hostname and its IPv4 route before changing the local connection setting. The
hostname must identify the same intended database; a longer timeout does not
repair an unreachable IPv6 route. The current `npm run dev` command watches
`.env` and restarts after configuration changes. If the server was started with
the older command, enter `rs` in its nodemon terminal or restart it normally.

The running backend rechecks a disconnected database every ten seconds and
restores database-backed routes when connectivity returns. Checks share one
connection attempt and reuse the existing pool. Recovery does not rerun failed
transactions, apply schema changes, or submit emails.

Checkout offers three separate, unchecked opt-ins: one cart reminder, occasional
offer emails, and WhatsApp cart/favorite follow-up. Existing account emails and
historical carts are not automatically subscribed. The backend reprices the
cart before sending, links to the existing payment-status/retry page when a
Razorpay payment is still pending, and suppresses a reminder after a paid order
or a COD order. An unpaid online order's status label alone does not suppress
its payment reminder. A
Resend idempotency key protects repeated provider submissions; an ambiguous
provider result is recorded as uncertain and is not blindly resent. Each email
links to a confirmation page where the recipient can unsubscribe from all three
optional message types. Essential order emails are unaffected.

To email a new coupon, an admin explicitly clicks its mail icon in Settings →
Coupons. The campaign queue includes only customers who opted in to offer emails.
The Cart & Favorite admin page shows a **Prepare WhatsApp message** button only
when the customer opted in. That button opens a prefilled `wa.me` draft addressed
to the customer; the admin must review and send it manually from the company's
WhatsApp Business session. It does not send WhatsApp messages automatically.

Do not enable the worker until the migration, verified Resend sender, production
frontend URL, and consent language have been reviewed. No migration, email, or
WhatsApp message is performed by the code change itself.

## API Endpoints

Reviews and shipping-label print/sync requests use the existing database schema.
They do not run `CREATE TABLE` or `ALTER TABLE`. Those statements are restricted
to the explicit migration flow. If deployed requests report `Failed to load
reviews` or `Runtime database DDL is disabled` despite the tables existing,
deploy the backend fix that removes request-time schema creation. Review
moderation, verified-purchase checks, label claims and one-time print handoffs
continue through their normal data queries. Genuine database failures remain
errors; review loading offers an inline retry in the storefront.

### Auth
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login
- `POST /api/auth/google` — Google OAuth
- `GET /api/auth/me` — Get profile (auth required)

### Products
- `GET /api/products` — List all (query: `category`, `search`, `badge`)
- `GET /api/products/:slug` — Get by slug
- `POST /api/products` — Create (admin)
- `PUT /api/products/:id` — Update (admin)
- `DELETE /api/products/:id` — Delete (admin)

### Categories
- `GET /api/categories` — List all
- `POST /api/categories` — Create (admin)
- `PUT /api/categories/:id` — Update (admin)
- `DELETE /api/categories/:id` — Delete (admin)

### Orders
- `GET /api/orders/my` — User's orders (auth)
- `GET /api/orders` — All orders (admin)
- `GET /api/orders/track/:orderId` — Track by numeric ID (public)
- `POST /api/orders` — Create order (auth)
- `PUT /api/orders/:id/status` — Update status (admin)

### Invoice PDF downloads

Admin order invoices use the supplied A4 invoice design, including the original
logo, legal company name, GSTIN, billing/shipping blocks and product/SKU table.
`GET /api/orders/:id/invoice` returns an actual PDF. Add `?download=1` for an
attachment. Invoice numbers are the order ID followed by its order date in
`ddmmyyyy` format, using India time.

**Save All Invoices to Folder** on the Orders page asks for a destination and
creates one folder containing a separate PDF for every verified paid/COD order,
regardless of table filters or pagination. This works in Chrome/Edge on HTTPS
or localhost. Browsers without folder access offer **Download Invoice Folder**,
which downloads a complete ZIP containing the PDFs in one folder.

PDF filenames start with the customer's shipping name, followed by the order ID
(for example `Bikram Paul - Invoice-10339.pdf`). Names fall back to the recorded
customer name, then `Customer`. Windows filename characters are cleaned and long
names are shortened; the order ID keeps repeat customers' invoices distinct.
Individual downloads, folder downloads and ZIP entries use the same naming rule,
including Unicode names.

`GET /api/orders/admin/invoices` returns the order IDs and filenames. The browser
fetches up to three individual PDFs at a time, validates their PDF header and
closing marker, and shows progress. ZIPs are finalized in the browser after all
requests finish, avoiding an interrupted long server response with no ZIP index.
Failures are counted and listed by order in `Download-Report.txt`. Stopping a
folder download preserves completed PDFs; stopping a ZIP download discards it.
All invoice endpoints require admin authentication and use private/no-store
responses. The legacy `/api/orders/admin/invoices.zip` streaming endpoint remains
for older clients; the Orders page no longer uses it. Deploy both frontend and
backend for the new manifest endpoint and folder download flow.

The build/postinstall and test hooks apply a guarded fix to fontkit 2.0.4 for
valid NULL font-positioning anchors. This prevents Hindi text such as `रे` from
aborting invoice generation midway through an export. The patch skips only the
missing attachment, keeping subsequent font lookups and shaping enabled; review
and remove it when upgrading to an upstream release containing the fix.

Prices, quantities, variants, charges, discounts and totals come from stored
order snapshots, never current catalog prices. Payment IDs come only from paid
payment records. New COD and Razorpay orders snapshot the product SKU on the
server. Older invoices recover missing SKUs from the matching product ID, or a
unique exact slug/name for legacy items without IDs, including archived products.
Stored SKUs take precedence; deleted or ambiguous products show `Not assigned`.
Missing payment IDs display as `-`; legacy orders without a split charge
breakdown show combined shipping/packaging.
The stored total remains authoritative and any difference is explicitly shown
as an order adjustment. No new tax rate is inferred from packaging charges.

Deploy `backend/assets/invoice` alongside `backend/dist`. Generate synthetic
layout previews with `node -r ts-node/register/transpile-only scripts/previewInvoices.cjs`.

To assign stable `BM-000098`-style codes to products without a SKU, run
`node scripts/assignMissingProductSkus.cjs` from `backend` to preview the count,
then add `--apply` to save. The assignment uses a transaction, preserves existing
codes, and avoids collisions. It does not change prices or historical order data.

### Shipping Labels Dashboard

The admin Orders page can create or reopen a label in
`https://labels.brajmart.com`, open its real print page, and synchronize the
courier-confirmed status back to BrajMart. The integration is server-to-server;
labels credentials are never sent to the browser.

Printing uses a 90-second, single-use handoff created by the labels backend.
Opening it establishes the labels session and redirects directly to the print
page for that order, so the admin is not asked to enter labels credentials.
Deploy the matching ShippingLabelsDashboard backend change before deploying
this BrajMart change.

Required backend environment variables:

```env
SHIPPING_LABELS_APP_URL=https://labels.brajmart.com
SHIPPING_LABELS_API_URL=https://labels.brajmart.com/api/v1
SHIPPING_LABELS_USERNAME=your_labels_app_username
SHIPPING_LABELS_PASSWORD=your_labels_app_password
SHIPPING_LABELS_SYNC_BATCH_SIZE=25
```

The label application requires an existing courier AWB/tracking number; it does
not purchase courier postage or generate an AWB. In Orders, first save the
shipping service and AWB, then use the printer button or **Sync Label Status**. Sync
automatically finds or creates the label mapping without opening a print tab.
BrajMart sends receiver
name, both address lines, city, state, six-digit pincode, mobile, courier, AWB,
order reference, prepaid/COD handling note, and item count.

Only an authenticated BrajMart admin can create or synchronize labels. The
backend accepts only orders already visible under BrajMart's verified-order
rule: COD orders or online orders with stored paid evidence. Cancelled,
delivered, and RTO orders cannot create printable labels. Tracking sync can
register delivered or RTO shipments without changing their terminal order
status. A database creation claim, the remote order reference, and matching
unassigned courier/AWB labels make repeated or concurrent print and sync clicks
idempotent. Missing remote labels are recovered on either action.

Automatic background sync runs twice daily at **6:00 AM and 6:00 PM IST
(Asia/Kolkata)**, regardless of the server's timezone. Starting or restarting
the backend waits for the next scheduled time; it does not trigger an extra
sync. The old `SHIPPING_LABELS_SYNC_INTERVAL_MS` setting is no longer used.
The backend must be running at the scheduled time. Each run processes up to
`SHIPPING_LABELS_SYNC_BATCH_SIZE` labels and makes requests for each label.
Manual printing and **Sync Label Status** remain available on demand.

The background sync asks ShippingLabelsDashboard to refresh the courier before
reading it. If that lookup is skipped or fails, BrajMart keeps the existing
order status. It accepts delivery progress only when the label contains a
successful-sync timestamp and a raw courier status; the editable label status
alone is not trusted. It advances orders monotonically to `shipped`,
`out_for_delivery`, `delivered`, or `rto`, records the courier response in the
order history, and never trusts a status supplied by the browser. Delivered and
cancelled orders cannot be overwritten. The detail modal also has a manual
**Sync Label Status** control.

Admin endpoints:

- `POST /api/shipping-labels/orders/:orderId/label` - create/reuse a label and return its print URL
- `POST /api/shipping-labels/orders/:orderId/sync` - find/create the label mapping, refresh its courier, and apply verified progress
- `POST /api/shipping-labels/sync` - run one throttled batch sync

### DTDC Tracking
- `GET /api/orders/dtdc/track/:lookup` - Live DTDC tracking for dispatched DTDC orders (public)
- `GET /api/orders/admin/dtdc/track/:lookup` - Live DTDC tracking lookup (admin)
- `POST /api/orders/admin/dtdc/pincode` - DTDC origin/destination pincode serviceability check (admin)

Environment variables:
- `DTDC_USERNAME` - DTDC API username
- `DTDC_PASSWORD` - DTDC API password
- `DTDC_ENV` - `production` or `staging` (defaults to `production`)
- `DTDC_ORIGIN_PINCODE` - Store pickup/origin pincode for pincode checks
- `DTDC_TRACKING_URL` - Optional production tracking URL override
- `DTDC_PINCODE_URL` - Optional pincode API URL override

### Payments
- `GET /api/payments` — All payments (admin)
- `POST /api/payments` — Record payment (auth)
- `PUT /api/payments/:id` — Update status (admin)

### Settings
- `GET /api/settings` — Get store settings (public)
- `PUT /api/settings` — Update settings (admin)

### Upload
- `POST /api/upload` — Upload image (auth, max 1MB)

### Verified Meta Purchases

See the [Meta Ads audit](docs/meta-ads-audit.md) for test results and the active
homepage Purchase rule and additional Facebook tags found in public Meta/GTM
configuration. Those account settings require cleanup as well as deploying the
local tracking fixes.

Meta `Purchase` is sent only after the backend verifies a captured payment with
the selected gateway. Razorpay payments must be captured, unrefunded, linked to
the stored Razorpay order, and match the stored order total exactly in paise
with currency `INR`. PayU payments must be confirmed as captured by PayU's
Verify Payment API and match the stored transaction ID and amount. A database
`paid` flag or a gateway-looking identifier alone is insufficient.

Razorpay checkout confirmation verifies the signature using the stored gateway
order ID, and webhooks verify a full SHA-256 signature against the exact raw
request body. PayU callbacks validate PayU's SHA-512 response hash and reconcile
against PayU's Verify Payment API. Every gateway path verifies the provider
before writing a paid status.
Reconciliation never matches payments by amount, time or customer notes alone.
Admin manual confirmation cannot convert a Razorpay or PayU checkout into a paid order.
COD and legacy manual payments do not send Meta `Purchase`.

The public `/api/meta/conversions` endpoint rejects `Purchase`. Browser tracking
also blocks Purchase through the app helper, `fbq`, `_fbq`, and the supported
Pixel request guards. Purchase value and contents come from the stored order.
The guards cover `fbq.push`, URL/Request fetch arguments, encoded POST bodies,
beacons and XMLHttpRequest while preserving asynchronous SDK dispatch. CAPI
requests are marked sent only when Meta reports that the event was accepted.
The backend uses the gateway payment timestamp and skips events over seven
days old rather than presenting historical payments as new purchases.

Each purchase uses `brajmart.Purchase.order.<orderId>` as its event ID. A unique
database reservation prevents simultaneous initial sends. Failed retries are
claimed atomically and reuse the same event ID. Network failures are recorded
as failed so a later explicit send can retry. There is no automatic retry queue;
an interruption or skipped gateway verification can require operational retry.

Run the isolated backend regression suite from `backend`:

```sh
npm test
```

Run the frontend tracking and HTML Pixel guard tests from `frontend`:

```sh
npm test
```

Tests use mocked database and external API responses. They do not create real
orders, charge payments or send events to a Meta dataset. Production deployment,
historical data, live Events Manager settings, GTM tags and other integrations
must be inspected separately to confirm the deployed dataset has no other
Purchase sources. Purchases already sent cannot be undone by these guards,
including payments subsequently refunded.

Official references:
- [Razorpay server integration and signature verification](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/)
- [Razorpay payment entity and fetch API](https://razorpay.com/docs/api/payments/fetch-with-id/)
- [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/)
- [Meta's official ServerEvent implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/server-event.js)
