# BRAJMART PERFORMANCE ENGINEERING - PHASE 7 COMPLETE

## 1. Executive Summary
Phase 7 proved that production still serves the pre-Phase-6 frontend and pre-Phase-5/6 backend. It added measured cart intent prefetch, safe accessibility fixes, and deterministic performance budgets to the current release candidate. No production deployment was performed.

## 2. Deployment Verification
Frontend: **OLD PRODUCTION**, 9,129-9,157 hydrated DOM nodes. Backend: **OLD PRODUCTION**, full product representation. Current optimized code: **CURRENT PREVIEW** only.

## 3. Production Measurement Environment
Lighthouse 12.8.2, bundled headless Chrome, Windows, 2026-09-23, three cold mobile and three cold desktop runs. Medians are reported; all runs are in `frontend/phase7-lighthouse-prod-*.json`.

## 4. Mobile Lighthouse Results
Runs: 28/28/27. Median 28; FCP 4,721 ms; LCP 19,040 ms; TBT 4,264 ms; CLS 0.0162; Speed Index 9,810 ms.

## 5. Desktop Lighthouse Results
Runs: 47/41/49. Median 47; FCP 1,086 ms; LCP 2,799 ms; TBT 913 ms; CLS 0.0587; Speed Index 2,777 ms.

## 6. Production LCP
The active eager/high-priority ImageKit hero image was LCP. Mobile median LCP was 19.04 s on stale production; current preview median was 5.10 s, but this is not a new-production claim.

## 7. Production CLS
OLD PRODUCTION median: 0.0162 mobile, 0.0587 desktop. Current preview Lighthouse: 0.0151 mobile, 0.0587 desktop; custom preview observer: 0.

## 8. INP Findings
Production field INP: **NOT MEASURED**. Lab timings: menu ~118 ms, search ~65-136 ms, wishlist ~405-478 ms, cart direct 1,202 ms and intent-warmed 757 ms.

## 9. RUM Architecture
No existing RUM or durable performance endpoint was found. GTM exists but its container/destination is not verifiable. RUM was not added; no PII or commerce data is collected.

## 10. Production DOM Verification
Production 9,129 custom / 9,157 Lighthouse nodes confirms the reduced Phase 6 frontend is not deployed. Preview is 4,199 custom / 3,869-3,870 Lighthouse nodes.

## 11. Long Task Attribution
OLD PRODUCTION significant first-party React tasks reached 1,467 ms. Google/Facebook contributed major tasks; GTM summary showed 1,431 ms main-thread and Facebook 1,090 ms. Unknown work remains explicitly unattributed.

## 12. CartDrawer First-Open Root Cause
The chunk is only 6.49 KB raw / 2.36 KB gzip. Direct open remains 1,202 ms, showing that request scheduling plus React/layout/presentation work, not chunk bytes alone, drives latency.

## 13. CartDrawer Optimization
PROBLEM: first open ~1.2 s. EVIDENCE: five-run direct median 1,202 ms. ROOT CAUSE: deferred request begins only at activation and is followed by render/presentation. IMPLEMENTATION: memoized import prefetched on hover, focus and pointer-down. FILES: `lazyCartDrawer.ts`, `App.tsx`, ProductCard, ProductDetailPage, BundleShelf. BEFORE: 1,202 ms direct. AFTER: 757 ms after completed intent. MEASURED IMPACT: 445 ms/37%. BUSINESS RISK: low; startup lazy behavior retained. SEO RISK: none. VALIDATION: chunk absent at startup, commerce tests pass.

## 14. Wishlist / Search Interaction Findings
No broad rerender regression was found. Existing lab timing remains acceptable relative to cart; no speculative change was made.

## 15. Third-Party CPU
Median mobile: GTM 318 KB / 1,431 ms main thread / 1,187 ms blocking; Facebook 203 KB / 1,090 ms / 987 ms; Ads 4 KB / 17 ms / 0 ms.

## 16. GTM / Analytics Audit
The app loads GTM, Google Ads and Meta directly after interaction or idle. GTM container duplication is possible but unproven. No tag was removed.

## 17. Product API Deployment Verification
Failed deployment gate: live list and detail representations are identical and include private/admin-oriented archive fields.

## 18. Product Payload Verification
Live `/products`: 346 records, 58,058 Brotli transfer bytes, ~484,526 decoded JSON bytes. Expected lightweight production reduction is not deployed.

## 19. Product List / Detail Cache Verification
Live headers include public 60 s cache, 300 s stale-while-revalidate, Brotli, ETag and Vary. Shape identity means representation-aware cache behavior cannot be verified on the stale backend.

## 20. Product SQL Projection Verification
Source uses explicit list projection and backend TypeScript builds. Live SQL behavior is **NOT MEASURED** because the expected backend is absent.

## 21. Collections Production Latency
2,006 / 1,020 / 1,018 / 1,016 ms; body `[]`.

## 22. Bundles Production Latency
1,974 / 1,276 / 1,287 / 1,769 ms; body `[]`.

## 23. MySQL Query Plan / Index Findings
**QUERY PLAN NOT MEASURED**. No approved safe DB environment was available; no speculative index was added.

## 24. Network Before vs After
OLD PRODUCTION Lighthouse transfer ~7.27 MB. CURRENT PREVIEW median Lighthouse transfer ~1.43 MB mobile / ~1.52 MB desktop. States differ, so this is release-candidate evidence, not a production improvement claim.

## 25. Core Web Vitals Status
LCP: failing old production lab mobile. CLS: passing. INP: unknown in field. Current preview custom LCP is 500 ms mobile / 860 ms desktop; preview Lighthouse LCP is 5.10 s / 1.15 s.

## 26. Accessibility Findings
Confirmed contrast, carousel target, footer heading order, redundant logo alt, action-name mismatch and overlap-related target issues.

## 27. Accessibility Fixes
PROBLEM: Lighthouse accessibility 90. EVIDENCE: failed semantic and target audits. ROOT CAUSE: 9 px click targets, H4 sequence, duplicate logo alt, mismatched action names. IMPLEMENTATION: 24 px indicator targets and semantic/name fixes. FILES: HeroCarousel, Footer, ProductCard. BEFORE: 90. AFTER: 92. MEASURED IMPACT: two Lighthouse points; three audit classes cleared. BUSINESS RISK: low. SEO RISK: none. VALIDATION: final accessibility-only Lighthouse.

## 28. Production SEO Verification
Robots, sitemap index and LLMS returned 200. Representative source pages expose canonical and structured data. Lighthouse SEO scored 100; local SEO verification passed.

## 29. Soft-404 Verification
Random `/phase7-definitely-missing-9f28d1` returned 404.

## 30. Hydration Verification
No page/console hydration errors on homepage, products, about, categories, representative category and product.

## 31. Responsive Verification
No document-level overflow at 320, 360, 390, 430, 768, 1024, 1280, 1440 or 1920 px. The 768 px header fix remains intact.

## 32. Performance Budgets
Budgets: main JS 285 KB raw, CSS 155 KB, CartDrawer 8 KB, homepage HTML 60 KB gzip, 90 prerender cards, 4,500 prerender DOM estimate. All pass via `npm run verify:performance-budgets`.

## 33. Functional / Commerce Tests
Vitest 7/7 and checkout Playwright 7/7 passed. Search/wishlist/cart smoke passed; no live payment was started. Full authenticated account/admin flows require credentials and were not executed.

## 34. Inventory / Payment Safety
No reservation, release, locking, stock validation, Razorpay signature, capture, order, auth or payment code changed.

## 35. Build / TypeScript / Lint Status
Frontend build passed with 406 routes; backend TypeScript passed; SEO passed; focused ESLint has zero errors and 16 pre-existing warnings.

## 36. Regressions Found and Fixed
No Phase 7 functional regression. The final disabled Buy Now accessible name was corrected after the first accessibility verification.

## 37. Changes Considered but Rejected
Rejected eager CartDrawer loading, blind tag removal, unverified RUM, speculative indexes, broad contrast/palette changes, and production DB experiments.

## 38. Remaining Bottlenecks
Deploy mismatch, mobile main-thread/TBT, hero LCP under throttling, third-party CPU, field INP/RUM, live collections/bundles latency, and unverified GTM duplication.

## 39. Phase 1 -> Phase 7 Performance Summary

| Metric | Original | Phase 6 | Phase 7 Baseline | Phase 7 Final |
|---|---:|---:|---:|---:|
| Mobile Performance | 33 | NOT MEASURED | 28 OLD PROD | 41 PREVIEW |
| Desktop Performance | 57 | NOT MEASURED | 47 OLD PROD | 69 PREVIEW |
| Mobile FCP | 5.1 s | NOT MEASURED | 4.72 s | 3.26 s preview |
| Desktop FCP | 0.8 s | NOT MEASURED | 1.09 s | 0.68 s preview |
| Mobile LCP | 12.5 s | 1.30 s custom | 19.04 s | 5.10 s preview |
| Desktop LCP | 2.2 s | 0.56 s custom | 2.80 s | 1.15 s preview |
| Mobile TBT | 1,590 ms | NOT MEASURED | 4,264 ms | 3,061 ms preview |
| Desktop TBT | 770 ms | NOT MEASURED | 913 ms | 718 ms preview |
| Mobile CLS | 0.006 | 0 custom | 0.0162 | 0.0151 preview |
| Desktop CLS | 0.062 | 0.005 custom | 0.0587 | 0.0587 preview |
| DOM nodes | ~9,205 | 4,204 | 9,157 OLD PROD | 3,870 preview LH |
| Long-task duration | NOT MEASURED | 1,998/2,571 ms | 2,041/2,253 ms custom | 1,369/1,418 ms custom |
| Initial transfer | ~7.1 MB | NOT MEASURED | ~7.27 MB | ~1.43/1.52 MB preview |
| API transfer | NOT MEASURED | NOT MEASURED | 58,058 B Brotli | NOT DEPLOYED |
| `/products` payload | ~482 KB raw | source optimized | ~484.5 KB decoded | NOT DEPLOYED |
| Cart first-open latency | NOT MEASURED | ~1,197 ms | 1,202 ms preview | 757 ms intent preview |

Preview and old-production columns are not directly interchangeable; the table deliberately labels them.

## 40. Exact Recommended Scope for Final Phase 8
Deploy frontend/backend together; verify DTO, cache and DOM version gates; repeat three-run production Lighthouse; enable privacy-reviewed sampled CWV RUM to an approved destination; inspect GTM container duplication; validate collections/bundles and read-only SQL plans; then tune remaining mobile TBT/third-party scheduling from new-production evidence. Do not start additional architecture work before deployment verification.
