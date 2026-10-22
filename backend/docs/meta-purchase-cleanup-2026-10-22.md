# Meta Purchase and tag cleanup — 22 October 2026

## Result

Repository changes protect the existing server-verified Purchase flow, recover
failed delivery, and block an automatic Meta CAPI gateway bypass. A later public
deployment recheck confirmed the updated frontend protection is now live and
passes the intercepted SDK replay on desktop and mobile. Backend deployment was
not independently verified. Meta/GTM account settings still need the changes below.

## Deployment recheck

A follow-up check on 22 October found the updated gateway guard in the deployed
homepage. The full SDK audit now passes for both deployed and local bootstraps on
desktop and mobile: one PageView and one AddToCart reach the intercepted Pixel
transport, and no Purchase or automatic gateway request escapes the guard.

The public Meta configuration still contains active rule **1762288044988453** and
the OpenBridge integration. The published GTM still contains tags **14**, **45**,
and **46**, including Pixel **2744712869202681**. The updated frontend blocks the
tested unwanted requests and keeps legacy GTM disabled, but account cleanup
remains necessary. The original bypass reproduction below describes the earlier
deployment, before the frontend update.

## Critical finding: homepage Purchase bypassed the deployed browser guard

The public configuration for Pixel **1824114108557446** still contains active
Event Setup Tool rule **1762288044988453**, deriving `Purchase` from the homepage
URL. It also enables `openbridge`, forwarding browser-generated events to:

- `fh-118116076e9a4c2a96a99fbb70bea2a0.ecs.us-west-2.on.aws/events`
- Fallback: `bded8a3c6ae-1-1053047382554.us-central1.run.app/events`

The audit downloaded the deployed bootstrap and current public Meta SDK/config,
then replayed them in a completely intercepted browser. On both desktop and
mobile, loading the homepage generated a gateway request whose JSON contained
`event_name: "Purchase"`. The deployed guard stopped the Facebook image request
but allowed the gateway request. Every request in this replay was intercepted;
no synthetic event reached a tracking service. This establishes a reproducible
unsafe delivery path, not a count of historical accepted or credited conversions.

The same replay with the updated local bootstrap emits one legitimate PageView
and one AddToCart, drains the SDK queue, and blocks the automatic gateway and
browser Purchase requests. The audit now fails when it observes the deployed
bypass, instead of passing because an SDK running with a headless user agent
emitted no events.

Public sources fetched on 22 October:
[deployed homepage](https://www.brajmart.com/),
[Meta configuration](https://connect.facebook.net/signals/config/1824114108557446),
[published GTM](https://www.googletagmanager.com/gtm.js?id=GTM-PBFHQWC4).

## Repository changes

- Install transport guards immediately, before deferred SDK startup.
- Block both publicly configured automatic CAPI relay hosts. Also inspect
  Meta-style Purchase JSON sent to `/events` on changed relay hosts, including
  fetch Request and modern Blob bodies. The app's `/meta/conversions` API and
  verified backend Graph API sender retain their existing routes.
- Reject queued browser purchases, whitespace/case variants, and legacy Google
  purchase labels in gtag, object, and eventModel dataLayer formats.
- Restrict the app tracking helper to supported non-purchase events. A broken
  browser SDK no longer interrupts cart updates or prevents its CAPI fallback.
- Retry Meta schema initialization after a temporary database failure.
- Atomically recover pending Meta reservations older than two minutes, using the
  original order-based event ID. Recent pending and sent events remain protected
  against concurrent duplicate sends. A later verified callback or receipt read
  triggers recovery; this change does not introduce a background retry worker.
- Reject malformed saved items and invalid quantities/prices instead of dropping
  items or replacing bad quantities with one. Preserve BLOB address phone matching
  and clamp small gateway clock skew to the present.
- Add repeatable tracking test commands and isolate browser artifacts under
  `frontend/.test-results/tracking`.

## Account and deployment work still required

1. Remove homepage Purchase rule **1762288044988453** from dataset
   **1824114108557446**. Remove equivalent click/URL-based Purchase rules and
   custom conversions after reviewing their purpose.
2. Disable the overlapping automatic CAPI Gateway/OpenBridge integration for
   this dataset when using this application's verified backend Purchase sender.
   Its current event blocklist does not include Purchase. Browser guards are a
   mitigation; remove the unsafe rule and overlapping integration at their source.
3. In **GTM-PBFHQWC4**, pause the overlapping Meta tags **14**, **45**, and **46**.
   Tag 46 uses the additional Pixel **2744712869202681**. Review legacy Google
   Purchase tag **13** alongside the configured GA4 purchase import. Publish the
   cleaned container. The app still keeps legacy GTM disabled.
4. Deploy/restart frontend and backend, then rerun the full public SDK audit.
   Review Meta Test Events and the corresponding real order/gateway records for
   a separately authorized real payment. No live payment was created by this audit.

Private advertising dashboards, production payment rows, and credited conversion
counts were not accessed. Existing historical analytics data was not deleted.

## Validation and repeatable commands

| Check | Result |
| --- | --- |
| Full backend suite | 152 passed |
| Meta/payment and Google tracking subset | 104 passed |
| Frontend unit suite | 75 passed |
| Chromium checkout, confirmation, and transport suite | 28 passed across desktop/mobile |
| Real Meta SDK replay with local bootstrap | Desktop and mobile passed |
| Real Meta SDK replay with deployed bootstrap | Initially detected the bypass; follow-up desktop/mobile replay passed after the frontend update |
| Frontend TypeScript and backend build | Passed |
| ESLint on all modified tracking TypeScript files | Passed |
| Frontend build | Completed with catalog fallback warning described below |

Run commands from the repository root:

```powershell
npm --prefix backend test
npm --prefix backend run test:tracking
npm --prefix frontend test -- --maxWorkers=2
npm --prefix frontend run test:tracking
npm --prefix frontend run typecheck
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend run audit:tracking-public
npm --prefix frontend run audit:meta-sdk -- --local-only
npm --prefix frontend run audit:meta-sdk
```

The last command checks both deployed and local code. It failed against the
original deployment and passed after the frontend protection was deployed.
Passing this replay does not certify private account settings or historical data.
Public SDK audits need network access for public assets; replay traffic is fully
intercepted. Backend tests use isolated database, gateway, and provider doubles.

Local environment inspection found matching Pixel/GA4 IDs, legacy GTM disabled,
live-mode Razorpay keys, configured backend provider secrets, no duplicate env
keys, and no private secrets exposed as frontend `VITE_` variables. Secrets were
not printed and neither `.env` file was edited.

Repository-wide ESLint reports 223 existing errors and 31 warnings outside the
modified tracking files. The frontend build completes but its configured catalog
API is unavailable, so prerendering uses fallback pages; retrying with network
access produced the same warning. This build is not a verified production catalog
artifact. Production deployment should use a reachable build API and strict SEO
prerendering.
