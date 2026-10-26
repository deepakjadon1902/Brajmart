# BrajMart Backend

Node.js + Express + MySQL backend for BrajMart e-commerce platform.

## Setup

1. Copy `.env.example` to `.env` and add your MySQL credentials and JWT secret
2. Run `npm install`
3. (Optional for local testing) Create `uploads/` directory: `mkdir uploads`
4. Add ImageKit credentials to `.env` if you want permanent deployed image storage.
5. Run `npm run dev` (development) or `npm start` (production)

## API Endpoints

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

Meta `Purchase` is sent only by the backend after a live-mode Razorpay API check.
The payment must be captured, unrefunded, linked to the stored Razorpay order,
and match the stored order total exactly in paise with currency `INR`. Both
payment records must agree on the paid payment ID and amount. A database
`paid` flag or a Razorpay-looking identifier alone is insufficient.

Checkout confirmation verifies the signature using the stored gateway order ID.
Webhooks verify a full SHA-256 signature against the exact raw request body.
Every gateway path that marks an order paid checks Razorpay before writing.
Reconciliation never matches payments by amount, time or customer notes alone.
Admin manual confirmation cannot convert a Razorpay checkout into a paid order.
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
