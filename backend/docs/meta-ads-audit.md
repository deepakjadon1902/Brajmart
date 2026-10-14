# Meta Ads Purchase Audit

Audit date: 2026-10-14. Scope: repository tracking code, isolated payment/CAPI
tests, browser transport tests, and read-only public deployment configuration.

## Live Findings Requiring Account Changes

### Active URL-Based Purchase Rule

The public configuration for Pixel `1824114108557446` contains an active
Event Setup Tool rule with these settings:

```json
{
  "derived_event_name": "Purchase",
  "rule_status": "ACTIVE",
  "rule_id": "1762288044988453",
  "condition_url": "https://www.brajmart.com/"
}
```

The JSON above summarizes the retrieved rule. The actual configuration registers
it through `fbq.set("estRules", "1824114108557446", ...)` and enables
`ESTRuleEngine`. Its condition has no payment, order, signature or capture check.
This is a configuration risk for a server-only verified Purchase policy. Its
presence alone does not prove that Ads Manager has counted false purchases.

Required account change: inspect the dataset's Event Setup Tool URL events and
remove the Purchase rule for the homepage. Confirm that other URL/click/automatic
rules cannot generate Purchase. Keep the server-verified CAPI Purchase as the
purchase source. This audit did not modify authenticated Meta settings.

Source: [public Meta Pixel configuration](https://connect.facebook.net/signals/config/1824114108557446).

### Published GTM Contains Additional Facebook Tracking

Container `GTM-PBFHQWC4` includes:

| Tag ID | Observed configuration |
| --- | --- |
| 45 | Facebook variable-event template using Pixel `1824114108557446` |
| 46 | Facebook variable-event template using Pixel `2744712869202681` |
| 14 | Facebook base code initializing Pixel `1824114108557446` and sending PageView |

Both variable-event templates map a data-layer `purchase` event to `Purchase`.
Their event IDs use GTM's start time and unique event ID, rather than the backend
order event ID. The container also has a `purchase` predicate. These browser tags
provide a separate Purchase path without backend payment verification.

Required GTM change: remove browser Purchase generation from the Facebook tags,
remove redundant Facebook initialization/PageView tracking, and check whether
the second Pixel belongs on this website. The application's existing guard blocks
that second Pixel; the isolated replay confirmed the attempted initialization.
Preserve unrelated Google Ads tags when reviewing the container.

Source: [published GTM container](https://www.googletagmanager.com/gtm.js?id=GTM-PBFHQWC4).

## Local Fixes Made During This Audit

- Block Purchase when fetch receives a URL object, a Request object, or an encoded POST body.
- Block Purchase in beacon POST data and XMLHttpRequest POST data.
- Route `fbq.push` through the same Purchase guard as `fbq` and `_fbq`.
- Preserve SDK dispatch after it asynchronously installs `fbq.callMethod`.
- Prevent subsequent calls from re-enabling automatic Pixel configuration.
- Require CAPI `events_received: 1` before recording a one-event request as sent.
- Keep zero-acceptance, error, malformed-response and network failures retryable.
- Add a ten-second timeout to CAPI requests.

These source changes have not been deployed by this audit.

## Verification Results

| Check | Result |
| --- | --- |
| Backend payment and Meta CAPI regression tests | 66 passed |
| Frontend Meta helper and actual HTML guard tests | 35 passed |
| Chromium desktop and mobile transport tests | 2 passed |
| Backend TypeScript check | Passed |
| Changed frontend test/config lint | Passed |
| Frontend production bundle | Passed |
| Git whitespace check | Passed |

The backend tests cover forged signatures, unpaid/authorized/failed/refunded
payments, wrong order/ID/amount/currency, test-mode payments, manual/COD exclusion,
simultaneous sends/retries, accepted-response handling and customer-data hashing.
Valid signed checkout, webhook and reconciliation flows also pass.

The browser tests intercept every external request. They verify that synthetic
Purchase calls cannot escape through the tested transports and that a legitimate
AddToCart call reaches the emulated SDK. No test purchases or tracking events are
submitted to an external service.

## Public SDK Replay

The actual public Pixel SDK, Pixel configuration and GTM container were replayed
with both the deployed and local bootstrap on desktop/mobile. Every browser
network request was intercepted before navigation.

The deployed bootstrap's queue increased from one to six entries, and the tested
AddToCart call did not reach the SDK dispatch function. With the local fix, both
queue measurements were zero and AddToCart reached the real SDK dispatch function.
The SDK reported a duplicate Pixel ID and an unverified-event suppression warning.
No outgoing Purchase transport was observed in these isolated replays.

The replay therefore confirms the dispatch fix and configuration conflicts. It
does not establish that Meta accepts events in production, that the URL rule is
currently increasing Ads Manager counts, or that historical conversions are valid.
Private Events Manager settings, campaign optimization selections and production
payment/conversion rows were not inspected.

## Repeat The Checks

From `backend`:

```sh
npm test
node scripts/auditMetaPublicSources.cjs
```

From `frontend`:

```sh
npm test -- metaPixel
node node_modules/@playwright/test/cli.js test --config playwright.meta.config.ts
node scripts/probe-meta-public.cjs
```

Public-source checks need network access. SDK replay also requires Chromium and
the installed frontend development dependencies. Neither command changes remote
configuration. Use Meta Test Events to verify a separately authorized real payment
after deployment and account cleanup; do not send fabricated Purchase events to
the production dataset.

## Official Reference

Meta's [ServerEvent implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/server-event.js)
defines the event timestamp, action source and deduplication ID. Its
[EventRequest implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-request.js)
reads the returned `events_received` value. The audit's stable order ID and
acceptance checks follow those data contracts.
