# BRAJMART PERFORMANCE ENGINEERING — PHASE 5 COMPLETE

## 1 Executive Summary

Phase 5 reduced the public catalog representation and removed repeated collection/bundle schema checks from steady-state requests. Measured homepage fetch traffic fell from 61,341 to 51,678 encoded bytes and from 495,913 to 325,462 decoded bytes. Builds, tests, prerender, and SEO verification passed; commerce logic was untouched. Phase 6 was not started.

## 2 Phase 5 Baseline Measurement

Custom Playwright baseline medians were 352 ms desktop LCP candidate and 300 ms mobile, with six long tasks and 61,341 encoded fetch bytes. Lighthouse CLI was unavailable, so no Phase 5 Lighthouse score was captured or inferred.

## 3 Current LCP Element

Desktop: homepage product-section `H1` text (`Prasadam`/`Seva Vigrahas`). Mobile: Purpose Discovery linked title (`Radha-Krishna...`). The hero image was not the observed LCP candidate.

## 4 LCP Breakdown

Warm median TTFB was about 15–16 ms. Because LCP was text, resource delay/duration are not applicable; approximate render delay was 337 ms desktop and 285 ms mobile. One 7.36 s desktop cold-like outlier is retained in the raw baseline artifact.

## 5 Current Network Waterfall

Before: document 53,889 encoded bytes, CSS 25,706, scripts 85,885, other/third-party 80,194, fetch 61,341. After: document/CSS/other unchanged, scripts 85,942, fetch 51,678.

## 6 Phase 1 Image Verification

Responsive ImageKit candidates, `sizes`, lazy/async below-fold behavior, and eager high-priority hero behavior remain intact. No hero preload was reintroduced.

## 7 CartDrawer Verification

The Cart Drawer chunk did not load on six clean public routes in baseline or final smoke runs. An explicit open-cart rerun was blocked by the preview-server approval usage limit and was not bypassed.

## 8 Hydration Verification

All six tested routes rendered without page errors. No hydration architecture was changed in Phase 5.

## 9 Prerender Verification

Production build prerendered 406 routes: 346 product, 36 category/subcategory, 5 blog, and 19 static routes. SEO verification passed.

## 10 /products Payload Root Cause

The default endpoint returned full database/domain objects to list consumers. Live response: 346 products, 482,321 raw bytes; largest avoidable fields included metadata, variant pricing structures, internal stock fields, and archive metadata.

## 11 /products Consumer Analysis

Consumers checked: product store, Product Card, Products page filtering/search, product detail, admin products, and build-time SEO/prerender. Public cards need a list subset; admin and prerender require full detail.

## 12 Public Product DTO Changes

Default list output removes internal IDs, SEO metadata, variant/size structures, attributes, reservation thresholds, and archive audit fields. It preserves card/search/purchasability fields and up to two images. Full output is available with `?view=detail`.

## 13 Homepage Catalog Data Changes

Homepage runtime receives the lightweight list DTO. Existing Phase 4 homepage prerender trimming remains unchanged.

## 14 Search Data Changes

`description`, tags, category, and core product fields remain available so current storefront search behavior is preserved. Attributes were removed from the public list after consumer review.

## 15 Category Data Changes

Category pages use the same public list DTO and retain all card, category, price, image, rating, availability, and COD fields.

## 16 Collections Endpoint Findings

Collection routes repeatedly invoked schema DDL checks. A shared promise now runs schema initialization once per process. Deployed latency impact is not yet measured.

## 17 Bundles Endpoint Findings

Public bundle reads repeatedly invoked commerce schema checks, including duplicate-safe alteration work. Schema initialization is now once per process. Deployed latency impact is not yet measured.

## 18 Database Query Findings

`/products` uses one joined query plus an approved-review aggregate, but still selects `p.*`. DTO work reduces serialization/network cost; narrower SQL projection remains future work.

## 19 MySQL Index Findings

No production `EXPLAIN`, schema inventory, or index mutation was performed. There is insufficient measured evidence for a safe index change.

## 20 N+1 Findings

No product-list N+1 was found. Collection and bundle code showed repeated schema setup, not a confirmed per-row query pattern.

## 21 Cache / ETag Findings

The 60-second public cache and 300-second stale-while-revalidate policy remain. `fresh=1` remains no-store. In-process cache entries are now keyed by list/detail representation. No ETag was added.

## 22 Compression Findings

Express compression remains enabled. The captured live catalog was 482,321 raw bytes, 59,345 gzip, and 46,880 Brotli when locally compressed.

## 23 API Before vs After

`/products` projects from 482,321 to 311,870 raw bytes, 59,345 to 48,921 gzip, and 46,880 to 39,219 Brotli. This is based on the captured live payload transformed through the new DTO; a deployed after-response is not yet available. Categories were unchanged. Collections/bundles received code-level schema guards but no deployed after-latency measurement.

## 24 Homepage Network Before vs After

Measured fetch resources fell 9,663 encoded bytes (15.8%) and 170,451 decoded bytes (34.4%). Total tracked encoded resources excluding the document fell from 253,126 to 243,520 bytes.

## 25 Main Thread / TBT Findings

Median custom long-task count stayed at six. Lighthouse TBT was not available. Reduced JSON bytes should reduce parse/allocation work, but parse CPU was not separately attributed and no CPU improvement is claimed.

## 26 Long Task Findings

The Long Tasks API reported six warm-run tasks before and after. Third-party startup remains a likely contributor, but attribution requires a production trace.

## 27 Bundle Verification

Main JS built at 85.94 kB gzip versus 85.89 kB in Phase 4. Resource timing showed a 57-byte encoded increase. No eager Cart Drawer loading was observed.

## 28 HTML / Prerender Size Verification

Homepage: 360,483 raw / 53,889 gzip / 42,583 Brotli. Products: 519,571 raw / 68,271 gzip / 53,932 Brotli. Phase 4 prerender behavior was preserved.

## 29 Mobile Lighthouse Before vs After

Original pre-Phase-1 Lighthouse: performance 33, FCP 5.1 s, LCP 12.5 s, TBT 1,590 ms, CLS 0.006. Phase 5 Lighthouse baseline/after: not measured; CLI unavailable. Custom warm LCP candidate median moved from 300 to 312 ms, not a claimed regression or improvement.

## 30 Desktop Lighthouse Before vs After

Original pre-Phase-1 Lighthouse: performance 57, FCP 0.8 s, LCP 2.2 s, TBT 770 ms, CLS 0.062. Phase 5 Lighthouse baseline/after: not measured. Custom warm LCP candidate median moved from 352 to 400 ms within a small local sample.

## 31 Core Web Vitals Status

No production CWV pass/fail claim is made. Local LCP candidates were fast; INP and production CLS were not measured in Phase 5.

## 32 Accessibility Status

No dedicated axe or Lighthouse accessibility run was available. No UI semantics or interaction code changed, and route smoke tests produced no page errors.

## 33 SEO Verification

Passed for rendered HTML, product content, schemas, canonicals, `llms.txt`, sitemap exclusions, and 406 prerendered routes. Build-time catalog loading explicitly requests full detail.

## 34 Functional Test Results

Frontend tests passed: 2 files, 7 tests. Six public routes passed browser smoke checks without page errors. A new end-to-end checkout run was not performed because it required the denied preview restart.

## 35 Inventory / Checkout / Payment Safety

No inventory mutation, reservation, checkout, payment, pricing, order, authentication, or product-detail endpoint code changed. Public DTO retains fields required by product cards, purchasability, and cart snapshots.

## 36 Build / TypeScript / Lint Status

Backend build passed. Frontend production build passed. SEO verification passed. Focused frontend lint reached only pre-existing `no-explicit-any` debt in `api.ts` and `productStore.ts`; the changed build script was clean. Backend lint could not run because no script exists and registry access for `npx eslint` was denied.

## 37 Regressions Found and Fixed

Separating list/detail payloads could have starved admin and prerender consumers. Both now explicitly request `view=detail`, and the in-memory cache key includes representation to prevent cross-serving.

## 38 Changes Considered but Rejected

Rejected in Phase 5: speculative MySQL indexes, a risky `p.*` projection rewrite without query plans, removing descriptions before search redesign, ETag changes without deployment validation, and any further image/marketing-script changes.

## 39 Remaining Bottlenecks

Production Lighthouse/INP, 9,185 homepage DOM nodes, third-party CPU and transfer, full-row SQL selection, catalog descriptions, deployed collections/bundles latency, and real MySQL plans/index inventory remain.

## 40 Exact Recommended Scope for Phase 6

Deploy Phase 5, capture mobile/desktop Lighthouse and production traces, measure endpoint cold/warm percentiles, collect `EXPLAIN ANALYZE` plus index inventory, replace `p.*` with representation-specific projections, reduce homepage DOM, profile third-party long tasks, and validate real-user INP/CLS. Preserve all Phase 1–5 architecture and commerce invariants.
