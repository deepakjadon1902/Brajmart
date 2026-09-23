# BRAJMART PERFORMANCE ENGINEERING — PHASE 6 COMPLETE

## 1. Executive Summary

Homepage DOM fell from 9,205 to 4,204 nodes (54.3%). Desktop/mobile long-task duration fell 41.5%/32.7%, hydration became error-free, desktop CLS fell from 0.429 to 0.005, and list SQL now uses an explicit projection. Phase 7 was not started.

## 2. Phase 6 Baseline

Production-preview baseline: desktop LCP candidate 1,892 ms, CLS 0.429, 14 long tasks totaling 2,571 ms; mobile LCP 1,300 ms, CLS 0, 14 tasks totaling 1,998 ms. These are not production CWV.

## 3. Production / Measurement Environment

Three Chromium production-preview runs per profile used Performance, Long Tasks, Event Timing, Layout Shift, and resource timing APIs. Deployed API endpoints were measured separately. Lighthouse was unavailable.

## 4. Current LCP Findings

Final custom median LCP candidate was 560 ms desktop and 420 ms mobile. This is local warm preview data, not Lighthouse or CrUX.

## 5. Homepage DOM Root Cause

The homepage rendered 226 ProductCards averaging 38.6 nodes. Full category arrays in eight carousels accounted for most of the 9,205-node document.

## 6. DOM Composition Before

Largest sections were Books (2,042 nodes/55 cards), Accessories (1,807/48), Groceries (1,620/44), Most Selling (866/22), Clothing (695/18), and Prasadam (682/17).

## 7. DOM Architecture Changes

Homepage collection shelves now render 12 meaningful crawlable cards and retain existing View More/category routes. Homepage serialized data uses the same shelf selection and list representation.

## 8. DOM Before vs After

| Total before | Total after | Reduction |
| ---: | ---: | ---: |
| 9,205 | 4,204 | 5,001 (54.3%) |

## 9. Product Card DOM Findings

One card averaged 38.6 nodes. Card semantics and controls were retained; reducing repeated card instances produced greater value than micro-removing semantic elements.

## 10. Carousel / Hidden Markup Findings

Embla did not clone slides. The multiplier was all-item rendering, not duplicate desktop/mobile trees. CartDrawer and navigation menus remain on demand.

## 11. Rendering / Layout Findings

The large DOM amplified hydration and layout work. A 768 px header overflow was fixed by showing optional Login/Sign Up buttons from `lg` while preserving account access below that breakpoint.

## 12. Long Task Root Causes

Tasks were primarily reported as `self`/`unknown`; function attribution was unavailable. Timing aligned with hydration, carousel/card initialization, catalog refresh, images, and deferred marketing startup.

## 13. Long Tasks Before vs After

Desktop: 14 to 14 tasks, 2,571 to 1,504 ms. Mobile: 14 to 13 tasks, 1,998 to 1,345 ms. Duration improved materially; count remained noisy.

## 14. INP Findings

Real INP was NOT MEASURED. Event/harness timings indicate mobile menu at 118 ms, mobile search at 65 ms, desktop search at 136 ms, and first CartDrawer open at 1,197 ms end to end.

## 15. Search Interaction Findings

Search remained responsive in the custom harness. No search architecture or Zustand redesign was justified.

## 16. Wishlist / Cart Interaction Findings

Wishlist harness duration was 478 ms desktop and 405 ms mobile. CartDrawer stayed unloaded until add-to-cart, then loaded and displayed correctly. Seven checkout-safe tests passed.

## 17. Third-Party CPU Findings

Meta transferred 202,614 encoded bytes; Google Ads transferred 2,716 bytes in the sampled run. CPU and long-task ownership were NOT ATTRIBUTED.

## 18. GTM / Ads / Meta Findings

All remain deferred to idle or first interaction. GTM container contents were unavailable, so duplicate tags were not proven and no analytics integration was removed.

## 19. Product SQL Projection Findings

Default list requests used `p.*` despite discarding SEO, variant, archive, reservation, and pricing structures in the DTO.

## 20. SQL Changes

List requests now select 21 consumed product columns plus joined category/review fields. Detail/admin/prerender retain `p.*`. Query time and result bytes are NOT DB-MEASURED.

## 21. Collections / Bundles Latency

Production remains undeployed: collections measured 1,550/1,098/1,075 ms; bundles 2,087/1,336/1,331 ms. Both returned `[]`.

## 22. API Contract Verification

Homepage, cards, search, categories, details, admin detail, and prerender consumers were reviewed. Public list fields remain sufficient; detail-by-slug is unchanged.

## 23. Cache Representation Verification

Code preserves representation-aware list/detail keys. Live behavioral verification awaits backend deployment; production still returns the old full payload.

## 24. Network Before vs After

Phase 5 fetch savings remain preserved at 51,678 encoded/325,462 decoded bytes in preview. Final homepage HTML is 53,538 gzip. Production `/products` is still 482,321 raw bytes because deployment is pending.

## 25. Bundle Verification

Main JS is 86.09 kB gzip versus 85.94 kB in Phase 5; CSS remains 25.71 kB gzip. The increase is small and reflects hydration normalization/measurement support outside the runtime bundle where applicable.

## 26. HTML / Prerender Verification

Homepage is 699,219 raw/53,538 gzip bytes with real SSR category, hero, settings, and 82 unique product cards. All 406 routes generated.

## 27. Hydration Verification

SSR/client Zustand initial snapshots now match. Six representative routes completed with zero console/page hydration errors.

## 28. Mobile Lighthouse Results

Original historical score: 33. Phase 6 Lighthouse: NOT MEASURED. Custom final LCP was 420 ms and CLS 0.

## 29. Desktop Lighthouse Results

Original historical score: 57. Phase 6 Lighthouse: NOT MEASURED. Custom final LCP was 560 ms and CLS 0.005.

## 30. Core Web Vitals Status

Production LCP/INP/CLS status remains unknown pending deployment and CrUX/Lighthouse measurement. Local LCP and CLS met target values.

## 31. CLS Status

Desktop CLS fell from 0.429 to 0.005 after fixing the Zustand SSR snapshot. Mobile final CLS was 0.

## 32. Accessibility Status

Semantic cards, headings, links, buttons, accessible names, keyboard menus, landmarks, and focus behavior were preserved. No dedicated axe score was captured.

## 33. SEO Verification

Passed for rendered content, product data, schemas, breadcrumbs, canonicals, sitemaps, `llms.txt`, and exclusions. Crawlable category/product links remain.

## 34. Responsive Verification

320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920 passed without document overflow after the header fix.

## 35. Functional / Commerce Test Results

Vitest: 7 passed. Checkout-safe Playwright: 7 passed. CartDrawer loaded only after interaction. Search, wishlist, add-to-cart, cart dialog, and checkout blocking were exercised.

## 36. Inventory / Payment Safety

No reservation, release, stock locking, authoritative validation, COD, Razorpay, payment, order, or pricing application code changed.

## 37. Build / TypeScript / Lint Status

Frontend production build, backend TypeScript build, SEO verification, changed-file ESLint, Vitest, and checkout-safe tests passed.

## 38. Regressions Found and Fixed

Fixed Zustand server/client snapshot mismatch, category/hero post-paint insertion, excessive homepage serialization, hydration errors, a 768 px header overflow, and an outdated checkout test assumption.

## 39. Changes Considered but Rejected

Rejected: deleting SEO content, card semantic flattening, carousel virtualization complexity, speculative indexes, eager CartDrawer, blanket React.memo, and removing/deleting analytics without tag evidence.

## 40. Remaining Bottlenecks

Backend deployment, production endpoint latency, third-party CPU attribution, real INP/CrUX, Lighthouse, first CartDrawer-open latency, MySQL query plans, and GTM container duplication analysis remain.

## 41. Exact Recommended Scope for Phase 7

Deploy Phases 5–6; capture three-run production Lighthouse and Chrome traces; verify live list/detail caching and SQL result reduction; collect safe `EXPLAIN ANALYZE`; profile first CartDrawer open and intent prefetch; audit GTM container tags and real third-party CPU; add RUM for INP/LCP/CLS; then set production-derived budgets. Preserve all Phase 1–6 architecture.
