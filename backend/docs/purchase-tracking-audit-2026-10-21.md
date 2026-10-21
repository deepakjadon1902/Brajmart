# Purchase tracking audit and setup

Audit date: 21 October 2026 (Asia/Kolkata).

## What the two exports establish

Both files were read completely as JSON data. Embedded HTML, JavaScript, tag
templates, and text were not executed or treated as instructions.

| File | SHA-256 |
| --- | --- |
| `tag_assistant_brajmart_com_2026_10_15.json` | `61f81866a79b619bcbf2fe65dc0bebab4a27d0a9177a67df6973690dc70df826` |
| `tag_assistant_brajmart_com_2026_10_15 (1).json` | `11fa8e7a6e945491a7a9dece0b932ac6ab71d659f7c151972067aeead6a2c608` |

The embedded export timestamps are 15:16:16 and 15:16:29 IST on 15 October.
Their entire `data.containers` captures are identical. These are two saves of
one observed session, not two independent payment tests.

Each capture contains these containers:

- Google tag `AW-17517087439`, alias `GT-NBQN3F72`, with destinations
  `AW-17517087439` and GA4 `G-CWTBY3XKNW`.
- GTM `GTM-PBFHQWC4`, in `QUICK_PREVIEW`, environment
  `Preview Environment 3 2026-05-18 000342`.

There are 26 messages per container representing the same underlying session.
Navigation reaches `/cart`, `/checkout`, then `/payment-status/[payment-token]`.
The URL does not establish payment capture.

| Observation | Meaning |
| --- | --- |
| No message named `purchase`; Google tag named `purchase` does not appear in `tagsFired` | These exports do not prove that a false Purchase was transmitted or counted. They also do not prove that a real paid purchase was successfully tracked. |
| `TechSol - Begin Checkout 45528` fires 11 times on `gtm.click` | Its trigger matches `/checkout` plus all clicks. Form interactions are being treated as checkout conversions. Eleven tag executions do not necessarily mean eleven credited Ads conversions. |
| Both `FB_CONVERSIONS_API-1824114108557446-Web-Tag-Pixel_Template` and the corresponding `2744712869202681` template fire six times | Two Meta pixels are active in the preview. Their events include `gtag.config`, PageView, and scroll. These names alone do not prove a server CAPI call. |
| `Meta Pixel ID 1824114108557446` also fires once | Redundant browser initialization exists alongside the application's own Pixel initialization. |
| Google Ads `purchase` tag 13 resolves Transaction ID, Conversion Value, and Currency Code as `{}` in the captured session | The export does not contain usable purchase values for those variables at that point. It cannot establish how they would resolve after a verified purchase. |

The Google purchase destination in the export is
`AW-17517087439/al0OCM6NiK8cEM-V5qBB`. The Begin Checkout destination uses label
`xeipCN7-h68cEM-V5qBB`; Add to cart uses `rBR8CPaO764cEM-V5qBB`.

## What is still wrong outside the repository

A read-only public-source check on 21 October confirmed:

1. Pixel `1824114108557446` still has ACTIVE Event Setup Tool rule
   `1762288044988453`, deriving **Purchase** from a URL condition for
   `https://www.brajmart.com/`. It has no payment/capture condition. This is a
   real unsafe configuration, although its existence does not establish how
   many historical conversions Meta credited.
2. The published GTM container still contains Meta tags 14, 45 and 46, including
   the second Pixel. The October 15 exports are a preview; their complete
   trigger configuration must not be assumed to equal today's published version.

Public sources:
[Meta Pixel configuration](https://connect.facebook.net/signals/config/1824114108557446),
[published GTM container](https://www.googletagmanager.com/gtm.js?id=GTM-PBFHQWC4).
These were fetched as text and parsed, without running their code or sending events.

Private Meta/Google Ads account settings, campaign goals, account conversion
counts, and production payment rows were not accessed. Primary/secondary goals,
custom conversions, GA4 event-creation rules, and historical attribution cannot
be established from these exports.

## Code changes

- The thank-you page now requires a successful server order lookup, a matching
  order ID, and an eligible order status. Failed lookups and sessionStorage no
  longer fabricate a verified confirmation or a paid amount.
- A stored Razorpay `paid` flag is rechecked against the gateway before the
  payment-status API returns a verified receipt. Unknown/unverifiable paid rows
  remain unconfirmed. These responses use `private, no-store`; the frontend also
  bypasses its HTTP cache.
- A temporary status API failure stays pending and polling can recover. Old
  requests cannot update a different payment after navigation.
- Production payment verification rejects test-mode Razorpay credentials.
- Repeated signed paid callbacks and verified receipt reads can retry failed
  tracking delivery, while each provider deduplicates by the stored order ID.
- Saved JSON/BLOB order items are supported consistently. Invalid/future payment
  times cannot become new purchase timestamps.
- Browser Google purchase events, purchase dataLayer pushes, the known legacy
  Google purchase label, and tested Google purchase transports are blocked.
  Existing Meta Purchase and foreign-Pixel guards remain in place.
- Legacy GTM is disabled by default. The direct Google base tag and the app's
  own Meta tracking remain. Unguarded noscript tracking was removed.
- Consented app actions now expose `add_to_cart`, `begin_checkout`, and
  `add_payment_info` custom events with sanitized ecommerce fields. They do not
  publish purchases or customer email/phone values.
- A new internal GA4 Measurement Protocol sender reports a Purchase only after
  the saved order, paid settlement IDs, captured live Razorpay payment, currency,
  and amount agree. There is no public endpoint accepting a claimed Google
  Purchase from a browser.
- The Google sender requires a real SDK client ID and analytics consent. It
  does not invent identities when consent or the SDK is unavailable. Ads user
  data/personalization consent is conservatively sent as DENIED; this is not a
  guarantee of Google Ads attribution for every store order.
- Google event rows store the original client ID and transaction payload for
  retries. Concurrent sends are reserved atomically; failed delivery is retryable.
  `submitted` means HTTP delivery succeeded, not that GA4 validated/processed it.

New tables are created lazily by the backend when Google tracking is configured:
`google_order_contexts` and `google_purchase_events`. The DB account needs CREATE
TABLE permission. No existing orders or historical conversion rows are deleted.

## Do these steps in order

### 1. Remove the Meta homepage Purchase rule

Open Meta Events Manager, select dataset **1824114108557446**, and inspect its
Settings/Event Setup Tool and automatic events. Remove Purchase rule
**1762288044988453** for the homepage. Also remove Purchase rules based on page
visits, `/checkout`, `/payment-status`, `/thank-you`, and button clicks. Check
custom conversions for equivalent URL rules. Keep the backend-verified standard
Purchase as the purchase signal used by your sales campaigns.

The exact menu labels can vary. The public rule above is the specific item to
find. This audit did not log into Meta or change those settings.

### 2. Clean GTM, then publish the cleaned version

In **GTM-PBFHQWC4**, pause:

- `Meta Pixel ID 1824114108557446` (tag 14).
- `FB_CONVERSIONS_API-1824114108557446-Web-Tag-Pixel_Template` (45).
- `FB_CONVERSIONS_API-2744712869202681-Web-Tag-Pixel_Template` (46), unless you
  have separately established why that dataset should receive this site's data.
- The legacy Google Ads `purchase` tag (13) if using the new GA4 purchase import.

For optional funnel reporting, replace the TechSol all-click checkout trigger
with Custom Event **begin_checkout**. Use **add_to_cart** for actual cart additions,
not page visits to `/cart`. The application now supplies these intent events.
Map ecommerce fields from `ecommerce`, not the unresolved generic variables.
Keep these funnel conversion actions Secondary in Google Ads.

Publish the cleaned GTM container; saving a workspace/preview is insufficient.
Leave `VITE_ENABLE_LEGACY_GTM=false` until that review is complete. If GTM is
needed afterward, explicitly set it to `true` and rebuild the frontend. No GTM
change is needed to enable the server GA4 purchase sender itself.

### 3. Configure the server Google purchase sender

In GA4, select web stream **G-CWTBY3XKNW**. Open Admin > Data streams > that web
stream > Measurement Protocol API secrets, and create a secret for this backend.
Set these in the backend hosting environment:

```dotenv
GA4_MEASUREMENT_ID=G-CWTBY3XKNW
GA4_API_SECRET=your_new_private_secret
NODE_ENV=production
```

Never place `GA4_API_SECRET` in a `VITE_` variable, GTM, HTML, a screenshot, or Git.
For the frontend, keep `VITE_GA4_MEASUREMENT_ID=G-CWTBY3XKNW` and
`VITE_ENABLE_LEGACY_GTM=false`. Retain the existing live Razorpay and Meta server
credentials. Do not leave `META_TEST_EVENT_CODE` set for production reporting.
Deploy/restart both backend and frontend; this audit has not deployed them.

If GA4 configuration is absent, Google purchase delivery intentionally stays
disabled; orders and Meta tracking continue. If consent is declined or the
analytics SDK is blocked, the order can still complete without a Google event.

GA4 receives a unique `transaction_id` equal to the BrajMart order ID. `value`
is net merchandise revenue, `shipping` includes shipping/handling fees, and
`order_total` is the captured total. Meta keeps the full captured order total.
Do not compare GA4 merchandise revenue with bank receipts without the fee fields.

References: [server event setup and secret handling](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events),
[purchase parameters](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events#purchase),
[transaction ID deduplication](https://support.google.com/analytics/answer/12313109).

### 4. Use one real purchase goal in Google Ads

Confirm GA4's `purchase` is a key event and the intended GA4 property is linked
to Google Ads. Import that purchase key event into Google Ads and make it the
Primary purchase action for the relevant sales campaigns. Do not simultaneously
keep the old direct website purchase as a second Primary purchase source.

Set Add to cart, Begin Checkout, page-view, and similar intermediate actions to
Secondary. Review custom campaign goals too: a secondary action inside a custom
goal can still influence bidding. Inspect GA4 Create/Modify Event rules and
remove rules that turn page visits or clicks into `purchase`.

See [Google's primary/secondary conversion guidance](https://support.google.com/google-ads/answer/11461796).
Ads attribution depends on consent, linking, identifiers, campaign interaction,
and attribution settings. Total store orders need not equal attributed ad purchases.

### 5. Verify without manufacturing production purchases

First browse Home, Cart, and Checkout, edit address fields, open a fake success
URL, cancel a payment, and reload. None should create a Purchase or a verified
payment receipt. COD orders may be confirmed, but are not paid online Purchase
events in this implementation.

Then complete one separately authorized real live payment. Check that the order
and Razorpay captured amount agree, Meta receives one server Purchase, and GA4
shows one purchase with the same transaction ID. Reload and repeat the gateway
callback: there should be no second order/purchase. Check GA4 processing and
Google Ads import separately; an HTTP 2xx alone is not proof of event acceptance.

Google supports a [validation endpoint](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events)
for checking a Measurement Protocol payload without recording it. Use test
fixtures locally; do not fabricate Purchase events in the production dataset.

## Historical data and remaining limits

Changing code cannot erase already credited Meta/Ads conversions. Preserve the
change date, separate before/after reporting, and reconcile historical order IDs
against Razorpay captures. Do not delete real orders to make analytics totals
match. Retractions/refund adjustments depend on each platform's available IDs
and account tools. Automatic historical corrections and refund-event delivery
are not introduced by this change.

These changes prevent the identified application paths from manufacturing
purchases; they cannot make a public analytics destination immune to every
third-party integration, external spam request, or private account rule. The
payment ledger and gateway remain the source of truth for paid orders.

## Repeatable checks

```powershell
node backend/scripts/auditTagAssistant.cjs 'C:\Users\in\Downloads\tag_assistant_brajmart_com_2026_10_15.json' 'C:\Users\in\Downloads\tag_assistant_brajmart_com_2026_10_15 (1).json'
# From backend:
npm.cmd test
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
npm.cmd run build
npm.cmd run validate:google-purchase
# From frontend:
npm.cmd test
npm.cmd run typecheck
node node_modules/@playwright/test/cli.js test --workers=1
node node_modules/@playwright/test/cli.js test --config playwright.meta.config.ts
```

Gateway, Google, and Meta calls in regression tests are isolated/intercepted.
No real order, payment, or production purchase event was created by the tests.

### Follow-up after configuring the real backend environment

The backend secret is present, has no whitespace or placeholder marker, and
stays out of frontend environment variables. Both measurement IDs match
`G-CWTBY3XKNW`; legacy GTM is disabled; the configured Razorpay key is live;
`META_TEST_EVENT_CODE` is absent. Environment files remain ignored by Git. Their
secret values were not printed or added to this report.

The new `npm.cmd run validate:google-purchase` command sent a synthetic payload
only to Google's **debug** endpoint. It returned `validationMessages: []` and
did not record a purchase, read/write an order, or call a payment provider.
Google explicitly does not validate API-secret ownership at that endpoint, so
this proves payload structure, not account access or production delivery.
Production acceptance still needs observation of an authorized real captured
order after deployment. See [Google's validation documentation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events).

Malformed saved product items now fail closed without throwing or submitting a
purchase. The previous frontend compiler errors were corrected with explicit
product/blog/hero/icon types, a browser timer type, a guarded navigation badge,
and a refresh callback that does not pass a click event as a search string.
`npm.cmd run typecheck` is now available. Browser tests share an automatic
network-isolation fixture: missing mocks cannot reach real APIs, tracking or
payment services. Old checkout labels and the delivery-check mock were updated
to match the current UI/API.

The latest backend suite passes **135 tests** and the frontend unit suite passes
**61 tests**. The complete browser suite passes **35 tests**, covering home
placement, invoices, shipping labels, checkout, purchase confirmation, and Meta
guards. Both frontend compiler configurations and the backend production
build pass. The two additional desktop/mobile Meta transport checks also pass. Targeted
lint for the new Google helpers, test fixture, and corrected shared components
passes.

The client/SSR production build and strict prerender completed with **407 routes
and 347 products** using the project's documented public backend. SEO checks
pass. A scan of 914 frontend build files found no occurrence of the backend GA4
secret. The production HTML keeps legacy GTM off and removes unguarded tracking
noscript tags.

Remaining checks/settings:

- The full frontend lint command reports 223 errors and 31 warnings, mostly
  existing `no-explicit-any` and hook-dependency/style findings across the wider
  app. Those rules were not disabled to manufacture a green result.
- The performance budget check reports main JavaScript 290,606 bytes versus a
  285,000-byte limit. Its CSS, cart chunk, rendered HTML, card and DOM budgets
  pass. This is not a purchase-validation failure.
- A direct read-only MySQL connection timed out after network access was
  allowed. No orders were inspected or changed, and live Google table existence
  could not be confirmed. Check database availability and the database host's IP
  allowlist/firewall before checking tables from the backend host. The new tables
  are created lazily when configured tracking first needs them.
- `NODE_ENV` is unset in the local backend file. Set `NODE_ENV=production` in
  production hosting and copy the GA4 server settings there; editing a local
  `.env` does not update a hosted service.
- Use `BUILD_API_BASE_URL=https://brajmart-1.onrender.com/api` (or the actual
  working backend origin) and `SEO_STRICT_BUILD=true` during deployment. The
  storefront's `https://www.brajmart.com/api/categories` returned 404; it is not
  currently an API proxy. Keep the browser's production `VITE_API_URL` /
  `VITE_API_BASE_URL` pointed at the actual backend unless such a proxy is added.

The Meta/GTM/Ads account steps above still require account-side changes. No
deployment or production purchase event was performed by this verification.
