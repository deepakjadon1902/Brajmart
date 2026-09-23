# BrajMart Phase 7 Performance Audit

Date: 2026-09-23  
Production: https://www.brajmart.com/  
API observed: https://brajmart-1.onrender.com/api  
Lighthouse: 12.8.2, bundled Chrome headless, cold-navigation runs

## Deployment Gate

| Component | Expected version | Deployed? | Evidence |
|---|---|---:|---|
| Frontend | Phase 6 reduced homepage | No | Production hydrates to 9,129-9,157 DOM nodes; current preview is 4,199 custom / 3,869-3,870 Lighthouse nodes. |
| Product API | Phase 5 public list DTO | No | Live list and detail have the same 40 keys, including admin/archive fields. |
| Product SQL | Phase 6 explicit list projection | Not observable live | Old response representation proves the expected backend release is absent. Source build passes. |
| Collections/bundles | Once-per-process schema setup | No evidence of deployment | Both endpoints still return `[]`; warm requests remain about 1.0-1.8 seconds. |

Production measurements in this report are therefore labelled **OLD PRODUCTION**. The optimized local build is **CURRENT PREVIEW**. There is no **NEW PRODUCTION** measurement.

## Worktree Safety

- Source changes were preserved.
- `backend/dist/**`, sitemap/LLMS output, Lighthouse JSON, Playwright reports, and test output are classified as generated artifacts.
- Existing untracked phase reports and unknown user-owned changes were not removed.
- No reset, clean, checkout, database write, deployment, or production load test was performed.

## Production Evidence

Six valid Lighthouse reports were captured. Lighthouse emitted a Windows temp-profile cleanup error after report creation; report JSON integrity was verified.

| Mode | Run | Performance | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 1 | 28 | 4,693 ms | 18,844 ms | 4,264 ms | 0.0162 | 9,810 ms |
| Mobile | 2 | 28 | 4,805 ms | 19,040 ms | 3,247 ms | 0.0162 | 9,356 ms |
| Mobile | 3 | 27 | 4,721 ms | 20,646 ms | 4,554 ms | 0.0162 | 9,824 ms |
| Desktop | 1 | 47 | 1,177 ms | 2,799 ms | 913 ms | 0.0587 | 2,778 ms |
| Desktop | 2 | 41 | 1,057 ms | 4,355 ms | 1,086 ms | 0.0588 | 2,777 ms |
| Desktop | 3 | 49 | 1,086 ms | 2,763 ms | 912 ms | 0.0587 | 2,564 ms |

Median OLD PRODUCTION: mobile 28 / 4,721 ms FCP / 19,040 ms LCP / 4,264 ms TBT; desktop 47 / 1,086 ms FCP / 2,799 ms LCP / 913 ms TBT.

The production LCP element is the eager, high-priority hero ImageKit image. Lighthouse LCP varied with the active hero slide. Production transfer was about 7.27 MB and unused JavaScript was 148-183 KB mobile and 166-201 KB desktop.

## Main Thread And Third Parties

The median mobile Lighthouse report attributed:

| Third party | Purpose | Trigger | Transfer | Main thread | Blocking | Action |
|---|---|---|---:|---:|---:|---|
| Google Tag Manager | Analytics/tag orchestration | interaction or idle timeout | 318 KB | 1,431 ms | 1,187 ms | Inspect container after deployment; do not remove blindly. |
| Facebook | Meta Pixel | interaction or idle timeout | 203 KB | 1,090 ms | 987 ms | Preserve tracking; evaluate later scheduling with business sign-off. |
| Google Ads | Conversion tracking | direct application load inside marketing initializer | 4 KB | 17 ms | 0 ms | Possible GTM duplication; container access required to prove. |
| Google Fonts | Typography | document CSS | 89 KB | 4 ms | 0 ms | No Phase 7 change. |

Significant OLD PRODUCTION long tasks included first-party React tasks of 1,467 ms, 790 ms, 575 ms and 559 ms; Meta tasks of 589 ms and 498 ms; Google Ads/GTM tasks of 541 ms, 288 ms, 280 ms and 277 ms. A forced-reflow audit reported about 46 ms in React, 41 ms in carousel code, and 257 ms unattributed. No non-composited animation was reported.

The application directly initializes GTM, Google Ads and Meta. Whether GTM also configures Ads or Meta cannot be established without container access. No tag was removed.

## API And Cache

Live `/products` returned 346 products, 58,058 compressed transfer bytes and about 484,526 decoded JSON bytes. Runs were 1,581 / 519 / 868 / 477 ms. Headers included `Cache-Control: public, max-age=60, stale-while-revalidate=300`, Brotli encoding, `ETag`, and `Vary: Origin, Accept-Encoding`.

List and detail shared the same response keys. The list exposed full description, SEO fields, variant structures, stock/reservation fields and archive metadata. This confirms the lightweight DTO and representation-aware cache release is not live; it does not prove a source defect in the current branch.

Collections runs were 2,006 / 1,020 / 1,018 / 1,016 ms. Bundle runs were 1,974 / 1,276 / 1,287 / 1,769 ms. Both returned `[]`. No safe database connection or non-production query-plan environment was available, so `EXPLAIN`, index inventory and query timings are **NOT MEASURED**. No index was added.

## Cart Investigation

The built CartDrawer chunk is 6,487 raw bytes / 2,360 gzip bytes, so transfer weight does not explain the whole delay. Five isolated preview runs compared a direct programmatic click against a completed pointer-intent fetch:

- Direct median: 1,202 ms.
- Intent-prefetched median: 757 ms.
- Median intent lead/fetch time: 825 ms.
- Measured subsequent-open improvement: 445 ms (37%).

The implementation memoizes the dynamic import and starts it on pointer enter, focus or pointer down on controls that open the drawer. It does not load at startup. Clean-route checks confirmed no CartDrawer resource before interaction.

## RUM Decision

No existing Web Vitals, PerformanceObserver telemetry, Vercel Analytics, or RUM endpoint was found. A `dataLayer` exists, but the deployed GTM container behavior and a durable metrics destination are not observable. Phase 7 therefore did not add an unverified telemetry producer. Production INP remains **NOT MEASURED**; lab interactions remain menu about 118 ms, search 65-136 ms, wishlist 405-478 ms, and cart direct/intent 1,202/757 ms.

## Accessibility And SEO

OLD PRODUCTION and initial preview accessibility scored 90. Safe preview fixes increased the verification run to 92 by fixing carousel indicator targets, footer heading order, redundant logo alt text, and product action accessible-name mismatches. Remaining confirmed findings are color contrast and overlap-related target size; broad palette/layout edits were rejected without visual validation.

Production robots, sitemap index and LLMS files returned 200. Representative homepage, products, category, product and blog source returned 200 with canonicals and JSON-LD. A random unknown URL returned 404, so no soft 404 was found. Local SEO verification passed for rendered HTML, product content, schemas, canonicals, LLMS and sitemap exclusions.

## Budgets

Budgets are release-candidate regression ceilings, not generic recommendations:

| Deterministic metric | Budget | Final |
|---|---:|---:|
| Main JS raw | 285,000 B | 275,176 B |
| CSS raw | 155,000 B | 147,344 B |
| CartDrawer raw | 8,000 B | 6,487 B |
| Homepage HTML gzip | 60,000 B | about 53,300 B |
| Prerendered homepage product cards | 90 | 82 |
| Prerendered homepage DOM estimate | 4,500 | 3,909 |

The automated check is `npm run verify:performance-budgets`.

## Validation

- Frontend production/catalog build: passed, 406 routes (346 product, 36 category, 5 blog, 19 static).
- Backend TypeScript build: passed.
- Vitest: 2 files, 7 tests passed.
- Checkout Playwright: 7/7 passed; no live payment started.
- Hydration smoke: no page or console errors on six representative routes.
- Responsive: no document overflow from 320 through 1,920 px; 768 px passed.
- SEO verification: passed.
- Focused ESLint: zero errors; 16 pre-existing warnings in already-modified files.
- Inventory, payment, auth and checkout business logic: unchanged.

## Phase 8 Gate

Phase 8 should deploy the current frontend and backend together, verify version markers/observable DTO and DOM behavior, then repeat the exact six-run Lighthouse matrix and collect real field RUM after an approved metrics destination exists. It should verify GTM container contents, Ads/Meta duplication, new-production API/cache latency, and safe database plans in a staging/read-only environment. No Phase 8 work was started.
