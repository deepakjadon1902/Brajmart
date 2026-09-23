# BRAJMART PERFORMANCE ENGINEERING - PHASE 1 RESULTS

Date: 2026-09-23

## Lighthouse

Live Lighthouse was not run from this environment. Original values are owner-supplied; Phase 1 values are marked not measured rather than estimated.

| Metric | Original Mobile | Phase 1 Mobile | Change | Original Desktop | Phase 1 Desktop | Change |
|---|---:|---:|---:|---:|---:|---:|
| Performance | 33 | NOT MEASURED | NOT MEASURED | 57 | NOT MEASURED | NOT MEASURED |
| FCP | 5.1 s | NOT MEASURED | NOT MEASURED | 0.8 s | NOT MEASURED | NOT MEASURED |
| LCP | 12.5 s | NOT MEASURED | NOT MEASURED | 2.2 s | NOT MEASURED | NOT MEASURED |
| TBT | 1,590 ms | NOT MEASURED | NOT MEASURED | 770 ms | NOT MEASURED | NOT MEASURED |
| Speed Index | 7.0 s | NOT MEASURED | NOT MEASURED | 2.0 s | NOT MEASURED | NOT MEASURED |
| CLS | 0.006 | NOT MEASURED | NOT MEASURED | 0.062 | NOT MEASURED | NOT MEASURED |

## Network

| Metric | Before | After | Difference |
|---|---:|---:|---:|
| Initial payload | 7,138 KiB supplied mobile | NOT MEASURED | NOT MEASURED |
| Image bytes | Lighthouse savings opportunity 3,964 KiB mobile | NOT MEASURED | NOT MEASURED |
| JS bytes | Main app JS 85.05 kB gzip | Main app JS 85.33 kB gzip | +0.28 kB gzip |
| CSS bytes | 25.70 kB gzip | 25.70 kB gzip | 0 |
| Requests | NOT MEASURED | NOT MEASURED | NOT MEASURED |

## Build

Measured with `npm run build` in `frontend`.

| Asset | Before | After |
|---|---:|---:|
| HTML | 4.60 kB raw / 1.70 kB gzip | 5.16 kB raw / 1.83 kB gzip |
| CSS | 147.65 kB raw / 25.70 kB gzip | 147.65 kB raw / 25.70 kB gzip |
| Main JS | 271.80 kB raw / 85.05 kB gzip | 272.64 kB raw / 85.33 kB gzip |
| React/vendor JS | 162.97 kB raw / 53.16 kB gzip | 162.97 kB raw / 53.16 kB gzip |
| Proxy chunk | 111.67 kB raw / 36.74 kB gzip | 111.67 kB raw / 36.74 kB gzip |
| Icons chunk | 43.38 kB raw / 8.10 kB gzip | 43.38 kB raw / 8.10 kB gzip |
| Carousel chunk | 22.06 kB raw / 8.87 kB gzip | 22.06 kB raw / 8.87 kB gzip |

## Root Cause Reports

### Hero Image Delivery

PROBLEM:
The homepage hero used a fixed desktop-width transform on every viewport.

EVIDENCE:
`HeroCarousel.tsx` requested `w-1920,h-532` and also preloaded the first two raw slide URLs through `new Image()`.

ROOT CAUSE:
The browser could not choose a smaller mobile candidate, and raw JS preloads could compete with the transformed visible image.

IMPLEMENTATION:
Added responsive `srcset` generation and changed hero candidates to `480, 768, 960, 1280, 1600`. Removed raw slide preloading. Kept the visible image eager with `fetchpriority="high"`.

FILES CHANGED:
`frontend/src/components/hero/HeroCarousel.tsx`, `frontend/src/utils/responsiveImage.ts`.

BEFORE:
One `1920x532` transformed image for all viewports, plus raw JS-created preloads.

AFTER:
Responsive transformed candidates and no duplicate raw preloads.

RISK:
Low.

VALIDATION:
Build passed; SEO verification passed. Actual candidate selection still needs browser network verification on preview.

### Product Card Images

PROBLEM:
Product cards downloaded images larger than their display size.

EVIDENCE:
Carousel cards render around `176-250px`; helper default was `720px`.

ROOT CAUSE:
The card context reused a generic square helper without responsive candidates.

IMPLEMENTATION:
Added `toSquareImageSrcSet`. Product cards now use `sizes` and candidates `220, 320, 480`, or `320, 480, 640` for first priority cards.

FILES CHANGED:
`frontend/src/components/product/ProductCard.tsx`, `frontend/src/utils/image.ts`.

BEFORE:
Default 720px square transform.

AFTER:
Viewport-aware thumbnail candidates.

RISK:
Low.

VALIDATION:
Build passed; focused lint passed.

### Navigation/Search/Category Images

PROBLEM:
Small UI images were not consistently transformed.

EVIDENCE:
Category icons, Braj Yatra menu icons, and search suggestions used raw image URLs in places.

ROOT CAUSE:
Image transform helper was not applied to all thumbnail contexts.

IMPLEMENTATION:
Applied small transforms: 56px category icons, 72px destination icons, 80px search thumbnails. Added dimensions and lazy/async decoding.

FILES CHANGED:
`frontend/src/components/layout/CategoryNavbar.tsx`, `frontend/src/components/layout/Navbar.tsx`.

BEFORE:
Potential raw/original thumbnail requests.

AFTER:
Small transformed thumbnail requests.

RISK:
Low.

VALIDATION:
Build passed; focused lint passed.

### Third-Party Startup

PROBLEM:
Marketing scripts initialized during critical startup.

EVIDENCE:
GTM, Google Ads, and Meta Pixel bootstrap scripts were in the document head.

ROOT CAUSE:
Third-party loading competed with first render and LCP.

IMPLEMENTATION:
Deferred marketing script injection until first interaction, scroll, idle callback, or timeout. Preserved noscript fallbacks.

FILES CHANGED:
`frontend/index.html`.

BEFORE:
Immediate script bootstrap in head.

AFTER:
Deferred injection.

RISK:
Medium because analytics pageview timing changes.

VALIDATION:
Build passed; SEO verification passed.

### Main Landmark

PROBLEM:
Homepage lacked a main landmark.

EVIDENCE:
Owner-supplied Lighthouse accessibility finding.

ROOT CAUSE:
Home content was wrapped in a generic div.

IMPLEMENTATION:
Added `<main id="main-content">` around storefront content and kept footer outside.

FILES CHANGED:
`frontend/src/pages/Home.tsx`.

BEFORE:
No homepage main landmark.

AFTER:
One main landmark.

RISK:
Low.

VALIDATION:
SEO verification passed; full accessibility score requires Lighthouse/aXe.

## Verification Status

Passed:
- `npm run build`
- `npm test` after running outside sandbox due esbuild filesystem access denial inside sandbox
- `npm run verify:seo`
- Focused eslint on changed TS/TSX files

Known existing validation issue:
- Full `npm run lint` still fails on pre-existing repository-wide lint debt such as `no-explicit-any`, shadcn empty interfaces, and hook dependency warnings in unrelated files.

Not measured:
- Live Lighthouse mobile/desktop.
- Network transfer bytes after deployment.
- Browser-selected `srcset` candidates at 360/390/1440 px.
- LCP element from a live performance trace.

## Remaining Bottlenecks

- Confirm actual LCP element and selected image candidate in a production-like browser trace.
- Split below-fold homepage sections in Phase 2 only if measured JS/main-thread cost justifies it.
- Consider a reduced homepage API payload in a later backend-safe phase.
- Audit contrast/touch-target/heading findings with a real accessibility report.
