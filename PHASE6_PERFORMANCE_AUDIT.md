# BrajMart Phase 6 Performance Audit

## Measurement environment

Phase 6 used the catalog-backed production frontend build, Vite production preview, Chromium/Playwright Performance APIs, Long Tasks API, Event Timing API, Layout Instability API, resource timing, and direct read-only production API requests. Three desktop and three mobile runs were captured before and after with the same harness. Lighthouse was unavailable; no Lighthouse, TBT, CrUX, INP, or database timing was fabricated.

## Baseline and final summary

| Metric | Desktop before | Desktop after | Mobile before | Mobile after |
| --- | ---: | ---: | ---: | ---: |
| DOM nodes | 9,205 | 4,204 | 9,205 | 4,204 |
| Custom LCP candidate | 1,892 ms | 560 ms | 1,300 ms | 420 ms |
| CLS | 0.4290 | 0.0050 | 0 | 0 |
| Long-task count | 14 | 14 | 14 | 13 |
| Long-task duration | 2,571 ms | 1,504 ms | 1,998 ms | 1,345 ms |

These are local production-preview measurements, not production Core Web Vitals.

## DOM composition

Baseline homepage product cards: 226. One ProductCard averaged 38.6 nodes. Product cards therefore accounted for approximately 8,700 nodes and were the dominant multiplier.

| Section | Before nodes | After nodes | Reduction | Technique | SEO impact |
| --- | ---: | ---: | ---: | --- | --- |
| BrajMart Special | 273 | ~273 | none | Existing six products retained | None |
| Most Selling | 866 | ~478 | ~388 | 22 to 12 cards | View More preserved |
| Prasadam | 682 | ~488 | ~194 | 17 to 12 cards | Category link preserved |
| Books category | 2,042 | ~492 | ~1,550 | 55 to 12 cards | Category link plus book feature preserved |
| Accessories category | 1,807 | ~492 | ~1,315 | 48 to 12 cards | Category link preserved |
| Clothing | 695 | ~492 | ~203 | 18 to 12 cards | Category link preserved |
| Groceries | 1,620 | ~492 | ~1,128 | 44 to 12 cards | Category link preserved |
| Devotional Accessories | 602 | ~458 | ~144 | 16 to 12 cards | View More preserved |
| Total document | 9,205 | 4,204 | 5,001 (54.3%) | Meaningful shelves plus full catalog routes | Crawlable cards/headings retained |

After section values are approximate ownership because the final mandatory total was measured directly; the implementation limit and final card count were verified exactly. Final prerender contains 82 unique cards, while each shelf is capped at 12 and duplicate products are serialized once.

## Major optimization: homepage DOM

- **PROBLEM:** The homepage hydrated 226 ProductCards and 9,205 total DOM nodes.
- **EVIDENCE:** Four category shelves contained 55, 48, 44, and 18 cards; each card averaged 38.6 nodes.
- **ROOT CAUSE:** ProductCarousel rendered every product passed by each homepage category, even though each section already linked to its complete catalog.
- **IMPLEMENTATION:** CollectionSection renders at most 12 crawlable cards while retaining headings, merchandise variety, carousel behavior, and View More/category routes.
- **FILES:** `frontend/src/components/sections/CollectionSection.tsx`, `frontend/scripts/prerender-pages.mjs`.
- **BEFORE:** 226 cards and 9,205 nodes.
- **AFTER:** 82 prerendered unique cards, 90 after live refresh, and 4,204 nodes.
- **MEASURED IMPACT:** 5,001 fewer nodes (54.3%); long-task duration fell 41.5% desktop and 32.7% mobile.
- **SEO RISK:** Reducing links/content on the homepage.
- **COMMERCE RISK:** Hiding inventory or breaking product navigation.
- **VALIDATION:** Full products/category routes remain, all section links remain, SEO verification passed, and all 406 routes prerendered.

## Major optimization: SSR and hydration parity

- **PROBLEM:** Correctly prerendering product shelves exposed desktop CLS and hydration errors.
- **EVIDENCE:** Desktop CLS was 0.429; the main shift inserted category/hero/settings content after paint. Browser validation reported React errors 418/423.
- **ROOT CAUSE:** Zustand React SSR reads `getInitialState()`, while initial data updated only live state. The client hydration snapshot also needed the same initial-state update.
- **IMPLEMENTATION:** Normalize category order and apply product, category, hero, and settings data to both live and initial Zustand snapshots before SSR/hydration.
- **FILES:** `frontend/src/lib/initialData.ts`.
- **BEFORE:** Empty category navigation/hero store snapshot in HTML, post-paint insertion, CLS 0.429, hydration recovery errors.
- **AFTER:** Prerendered category links and hero content, zero hydration errors, desktop CLS 0.005 and mobile CLS 0.
- **MEASURED IMPACT:** Desktop CLS reduced 98.8% in the production-preview methodology.
- **SEO RISK:** Server/client output mismatch could replace crawlable markup.
- **COMMERCE RISK:** Stale or mismatched catalog state during hydration.
- **VALIDATION:** Six public routes produced no console/page errors; SEO and route generation passed.

## Major optimization: SQL projection

- **PROBLEM:** The public list DTO discarded fields only after MySQL returned `p.*`.
- **EVIDENCE:** Static query and DTO consumer analysis showed list consumers require 21 product columns, not full SEO, archive, reservation, size, attribute, or variant fields.
- **ROOT CAUSE:** List and detail representations shared one SQL projection.
- **IMPLEMENTATION:** The list branch now selects explicit consumed columns; detail/admin/prerender requests retain `p.*`.
- **FILES:** `backend/src/routes/products.ts`.
- **BEFORE SELECT:** `SELECT p.*, ...` for every representation.
- **AFTER SELECT:** Explicit list columns for default view; `p.*` for `view=detail`.
- **FIELDS REMOVED FROM DB RESULT:** SEO metadata, archive audit, reserved/threshold stock fields, sizes, pricing matrices, attributes, and color/variant structures.
- **FIELDS PRESERVED:** IDs, names, slug, prices, images, category IDs, ratings, tags, availability/COD, stock, SKU, sold count, description, and timestamps.
- **MEASURED IMPACT:** NOT DB-MEASURED. Production backend is not deployed.
- **SEO RISK:** None for detail/prerender, which explicitly request detail.
- **COMMERCE RISK:** Missing card/search/purchasability fields.
- **VALIDATION:** Backend TypeScript build passed; frontend/admin/build consumer paths were reviewed.

## Rendering, long tasks, and interactions

The large React tree amplified hydration, reconciliation, carousel setup, image observation, and style/layout work. Long Tasks API attribution exposed `self`/`unknown` but not function-level script URLs, so exact per-task ownership remains unavailable. The node reduction lowered total long-task duration even though count remained noisy.

| Interaction | Input delay | Processing | Presentation | Total |
| --- | ---: | ---: | ---: | ---: |
| Desktop search typing | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 136 ms harness action |
| Desktop wishlist toggle | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 478 ms harness action |
| Mobile search typing | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 65 ms harness action |
| Mobile wishlist toggle | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 405 ms harness action |
| Mobile menu open | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 118 ms harness action |
| First cart open | NOT ISOLATED | NOT ISOLATED | NOT ISOLATED | 1,197 ms including lazy chunk/network/render |

These are end-to-end harness durations, not INP. CartDrawer remained absent on all clean routes and loaded only after add-to-cart.

## Third-party findings

| Third party | Transfer | CPU | Long tasks | Trigger | Change |
| --- | ---: | --- | --- | --- | --- |
| Meta Pixel | 202,614 encoded bytes | NOT MEASURED | NOT ATTRIBUTED | idle or first interaction | None |
| GTM / Google scripts | timing entries present; several cache/network-zero transfers | NOT MEASURED | NOT ATTRIBUTED | idle or first interaction | None |
| Google Ads | 2,716 encoded bytes observed | NOT MEASURED | NOT ATTRIBUTED | marketing loader | None |

Direct GTM, direct Ads, and direct Meta initialization are visible. GTM container contents could not be inspected, so duplicate-tag execution is unproven. Existing defer behavior was preserved rather than risking analytics loss.

## Deployed API verification

The production backend does not yet contain Phase 5/6 changes.

| Endpoint | Runs | Deployed bytes | Latency |
| --- | --- | ---: | --- |
| `/products` | 3 | 482,321 | 3,852 / 1,277 / 1,897 ms |
| `/collections` | 3 | 2 | 1,550 / 1,098 / 1,075 ms |
| `/bundles?location=home&limit=3` | 3 | 2 | 2,087 / 1,336 / 1,331 ms |

The lightweight catalog and SQL improvements remain projected until backend deployment. Collection/bundle promise guards are likewise not live, so deployed latency is still high.

## Build and validation

- Frontend production build: passed, 406 routes.
- Backend TypeScript build: passed.
- Main JS: 86.09 kB gzip; CSS: 25.71 kB gzip.
- Homepage HTML: 699,219 raw / 53,538 gzip bytes.
- SEO verification: passed.
- Vitest: 7 passed.
- Checkout-safe Playwright: 7 passed.
- Focused changed-file ESLint: passed.
- Hydration smoke: six routes, zero errors.
- Responsive: 320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920 all passed without document overflow.
- CartDrawer: absent before interaction, loaded on demand, dialog visible.
- Accessibility: semantic elements, landmarks, names, keyboard controls, and focus behavior preserved; no dedicated axe score was captured.
- Inventory/concurrency: no applicable automated script exists; inventory/payment source was unchanged.

## Performance guardrails

Recommended non-brittle review guardrails are homepage DOM below 4,800 nodes, main JS below 90 kB gzip, homepage HTML below 60 kB gzip, public list body below 350 kB raw after deployment, CLS below 0.1, and median long-task duration below 1,800 ms in this local methodology. CI thresholds should wait for production distributions.

## Remaining work

Deploy backend changes, remeasure live DTO/SQL/collection/bundle behavior, capture Lighthouse and Chrome traces, obtain field INP/CrUX, inspect GTM container tags, attribute third-party CPU, and profile first CartDrawer open. No Phase 7 work was started.
