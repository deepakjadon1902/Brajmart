# BrajMart Mobile 90+ Final Audit

Date: 2026-09-24

## Current Production Baseline

Authoritative supplied PageSpeed screenshots:

| Profile | Performance | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---:|---:|---:|---:|---:|
| Mobile | 57 | 100 | 100 | 100 | 4/4 |
| Desktop | 96 | 100 | 100 | 100 | 4/4 |

## Production Lighthouse Reproduction

Local Lighthouse 13.5.0 against production reproduced a severe mobile gap while preserving green gates. Absolute local scores differed from PageSpeed screenshots, so these are used for root-cause direction rather than as PSI replacements.

| Metric | Mobile Median | Desktop Median |
|---|---:|---:|
| Performance | 43 | 79 |
| FCP | 3.76 s | 1.07 s |
| LCP | 6.04 s | 1.47 s |
| TBT | 1,799 ms | 285 ms |
| Speed Index | 6.79 s | 1.68 s |
| CLS | 0 | 0.005 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| Agentic Browsing | 4/4 | 4/4 |

## Score-Loss Analysis

1. LCP: largest mobile score loss; median ~6.04 s.
2. TBT: severe mobile CPU sensitivity; median ~1.8 s.
3. Speed Index: late visual completion on mobile; median ~6.79 s.
4. FCP: slow but secondary to LCP/TBT.
5. CLS: healthy.

## Mobile LCP

The production mobile LCP element was the homepage hero image:

- Component: `HeroCarousel`
- Element: hero `<img>`
- Resource: ImageKit WebP hero image
- Attributes: `loading="eager"`, `fetchpriority="high"`, `sizes="100vw"`
- Discovery: present in initial document

Representative LCP breakdown from production mobile run 1:

| LCP Phase | Time |
|---|---:|
| TTFB | 269 ms |
| Resource load delay | 1,165 ms |
| Resource load duration | 197 ms |
| Element render delay | 1,580 ms |

The image itself was not large enough to be the dominant bottleneck. Render delay and CPU contention were the safer targets.

## Root Causes

### Product Carousel Startup

`ProductCarousel` imported and initialized Embla + autoplay for every shelf during startup. Lighthouse attributed heavy CPU to the carousel chunk under mobile throttling.

### Runtime Catalog Refresh

The homepage used prerendered data but still scheduled `loadProducts({ force: true })` early during startup. Production traces showed a `/api/products?fresh=1` request during the mobile critical window.

### Public Settings and Bundle Fetches

Public settings and below-fold bundle requests also entered the early startup window, creating additional state updates and network contention.

## Implemented Optimizations

1. Replaced product shelf Embla startup with native horizontal scrolling and native scroll buttons.
2. Deferred public catalog freshness until after the critical startup window.
3. Deferred public settings freshness until after startup on non-admin routes.
4. Deferred below-fold bundle fetching until the bundle shelf approaches the viewport.

## Files Changed

- `frontend/src/App.tsx`
- `frontend/src/components/product/ProductCarousel.tsx`
- `frontend/src/components/sections/HomeExperience.tsx`

## Validation

Passed:

- `npm.cmd run build`
- `npm.cmd run verify:performance-budgets`
- `npm.cmd run verify:seo`
- `npm.cmd test`
- `backend: npm.cmd run build`

Local post-change Lighthouse:

| Profile | Performance | FCP | LCP | TBT | Speed Index | CLS | Agentic |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile preview | 73 | 2.9 s | 3.7 s | 430 ms | 3.4 s | 0.015 | 4/4 |
| Desktop preview | 98 | 0.9 s | 0.9 s | 0 ms | 1.0 s | 0.003 | 4/4 |

Local preview accessibility/best-practices were reduced by fallback API conditions, not by the source changes: the local build cannot reach the live catalog/API and logs preview proxy 500s. Production baseline gates remain the authority after deploy.

## Rejected Changes

- No Lighthouse/PageSpeed detection.
- No removal of products or semantic content.
- No lazy-loading of the hero LCP image.
- No broad hydration rewrite.
- No commerce, payment, inventory, auth, order, review, or admin changes.
- No agentic/SEO architecture changes.

