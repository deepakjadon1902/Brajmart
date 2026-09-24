# BrajMart Final Mobile 90 LCP Audit

Date: 2026-09-24

## Executive Summary

Current authoritative production PSI baseline supplied by the prompt:

| Metric | Production before |
|---|---:|
| Mobile Performance | 73 |
| Mobile FCP | 3.3s |
| Mobile LCP | 4.7s |
| Mobile TBT | 50ms |
| Mobile Speed Index | 5.4s |
| Mobile CLS | 0 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| Agentic Browsing | 4/4 |
| Desktop Performance | ~98 |

The production Lighthouse trace captured locally on 2026-09-24 confirmed the remaining above-fold issue is the home hero image and critical rendering path, not broad JavaScript rewrites. The production trace varied from PSI because local Lighthouse simulation reported worse TBT, but it still identified the same LCP target and network/image diagnostics.

## Production Trace Evidence

Captured file: `lh-prod-mobile-lcp-1.json`

| Metric | Captured value |
|---|---:|
| Performance | 48 |
| FCP | 2.707s |
| LCP | 5.373s |
| TBT | 1646ms |
| Speed Index | 3.791s |
| CLS | 0.003 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

The prompt's production PSI result remains the official baseline. This trace was used for diagnostics and root-cause ranking.

## Exact Mobile LCP Element

The LCP element was the home hero image:

| Field | Value |
|---|---|
| Component | `frontend/src/components/hero/HeroCarousel.tsx` |
| Element | `<img class="absolute inset-0 h-full w-full object-contain object-center sm:object-cover">` |
| Alt | `Accessory` |
| URL family | ImageKit hero slide |
| Example selected URL | `https://ik.imagekit.io/.../Untitled_-_01_July_2026...webp?tr=w-960,h-336,c-at_least,q-74,f-webp` |
| Rendered box | 326 x 114 CSS px |
| Reported intrinsic/current candidate | 1213 x 336 |
| Transfer | ~60 KB |
| Estimated waste | ~42 KB |
| Loading | eager |
| Priority | high |
| Discovery | discoverable in initial document |

## LCP Phase Breakdown

Captured production trace:

| Phase | Time | Notes |
|---|---:|---|
| TTFB | 166ms | Healthy |
| Resource load delay | 424ms | Acceptable but still affected by early network competition |
| Resource load duration | 537ms | Too high for rendered mobile dimensions |
| Element render delay | 604ms | Meaningful; hero enhancement and critical render work still matter |

This indicated the highest-confidence fixes were:

1. Smaller mobile hero candidate.
2. Earlier production discovery/preload for the first prerendered hero.
3. Reduce high-priority competition from non-LCP product images.
4. Defer nonessential hero refresh/autoplay setup until after the critical window.

## Render Blocking And Network Findings

| Item | Finding |
|---|---|
| Root document | Healthy TTFB in trace |
| App CSS | Render-blocking, ~26 KB transferred, reported ~40ms savings |
| Google Fonts CSS | Loaded early and competed with critical resources |
| ImageKit | Hero plus product/logo imagery began in the first wave |
| Product images | Two product images transferred ~55 KB and ~83 KB near hero request time |
| Hero request | High priority and discoverable, but mobile candidate was oversized |

## Image Delivery Findings

The image-delivery diagnostic identified only the hero as the important opportunity in this pass.

| Image | Current bytes | Estimated waste | Above fold | LCP | Action |
|---|---:|---:|---|---|---|
| Home hero `Accessory` | ~60 KB | ~42 KB | Yes | Yes | Add mobile-specific `<source>` candidates with contain fit and lower mobile quality |

## Forced Reflow

Forced reflow was reported in PSI, but the captured trace returned an empty forced-reflow table. No code change was made for forced reflow because it was not evidenced as the dominant LCP/FCP bottleneck.

## JavaScript Findings

The prompt explicitly warned not to chase broad unused JavaScript because production TBT is already ~50ms. The trace supported keeping the implementation narrow:

| Diagnostic | Finding |
|---|---|
| Unused JavaScript | Present, but not primary given official production TBT |
| Hero carousel JS | Lightweight but still had refresh/autoplay timers during startup |
| Broad JS rewrite | Rejected |

## Changes Implemented

| File | Change |
|---|---|
| `frontend/src/components/hero/HeroCarousel.tsx` | Added mobile-specific `<picture><source>` hero candidates, reduced mobile quality to `q-70`, used mobile `fit: contain`, delayed hero refresh and autoplay setup |
| `frontend/scripts/prerender-pages.mjs` | Added data-driven mobile hero preload and ImageKit preconnect for the first active prerendered home hero slide |
| `frontend/index.html` | Changed Google Fonts from high-priority style preload to async print-media stylesheet swap |
| `frontend/src/pages/Home.tsx` | Removed eager/high-priority product-card images from the first homepage product shelf so the hero remains the clear early priority |

## Rejected Optimizations

| Optimization | Reason |
|---|---|
| Broad unused-JS rewrite | Production TBT is already solved; high commerce/hydration risk |
| Async-loading all CSS | FOUC/CLS risk; render-blocking savings are small |
| Removing marketing scripts | Already deferred; no trace evidence as primary LCP cause |
| Forcing AVIF globally | Previous evidence showed small savings; WebP/ImageKit path is stable |
| Hiding or removing commerce sections | Forbidden and unnecessary |
| Disabling SSR/prerender | Would harm SEO, agentic browsing, and LCP discovery |

## Remaining External Limitations

Local preview could not fetch the live catalog/backend API, so local Lighthouse used fallback SSR data and showed local-only API proxy errors. Production validation must be done after deployment on `https://www.brajmart.com/`.

The third desktop Lighthouse run was not completed because the approval/usage limit blocked another Lighthouse execution. Two desktop control runs were completed and parsed; desktop remained above the hard target.

