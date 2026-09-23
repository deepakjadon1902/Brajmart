# BrajMart Performance Audit

Date: 2026-09-23

## Current Baseline

Owner-supplied PageSpeed baseline:

| Metric | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 33 | 57 |
| FCP | 5.1 s | 0.8 s |
| LCP | 12.5 s | 2.2 s |
| TBT | 1,590 ms | 770 ms |
| Speed Index | 7.0 s | 2.0 s |
| CLS | 0.006 | 0.062 |

Local production build baseline before changes:

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| `dist/assets/index-*.js` | 271.80 kB | 85.05 kB |
| `dist/assets/react-*.js` | 162.97 kB | 53.16 kB |
| `dist/assets/proxy-*.js` | 111.67 kB | 36.74 kB |
| `dist/assets/index-*.css` | 147.65 kB | 25.70 kB |
| `dist/index.html` | 4.60 kB | 1.70 kB |

## Root Cause

### P0: LCP image discovery and payload

Affected files:
- `frontend/src/components/hero/HeroCarousel.tsx`
- `frontend/src/utils/responsiveImage.ts`

Evidence:
- The hero image is above the fold and likely to be the mobile LCP element when slide data exists.
- It was requested as a fixed `1920x532` ImageKit transform for every viewport.
- The component also preloaded the first two raw slide image URLs with `new Image()`, which could duplicate hero downloads and compete with the actual LCP image.

Risk:
- Low. This keeps the same hero image and priority behavior, but lets the browser choose smaller responsive candidates.

Implementation:
- Added reusable `srcset` generation.
- Changed hero image to `srcset` widths `480, 768, 960, 1280, 1600`.
- Kept only the visible hero image eager/high priority.
- Removed raw off-DOM slide preloading.
- Added explicit `width` and `height`.

### P0: Product/card image payload

Affected files:
- `frontend/src/components/product/ProductCard.tsx`
- `frontend/src/utils/image.ts`

Evidence:
- Product cards render at roughly 176 to 250 CSS px wide in the carousel.
- Thumbnails previously defaulted to 720px square transforms.

Risk:
- Low. Product images remain ImageKit/Cloudinary/upload transformed, with larger candidates retained for high-density displays.

Implementation:
- Added square thumbnail `srcset`.
- Changed non-priority cards to use 320px default and candidates `220, 320, 480`.
- Kept first priority cards at larger candidates `320, 480, 640`.
- Added `sizes`, `width`, `height`, and `fetchPriority`.

### P1: Small image transforms

Affected files:
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/CategoryNavbar.tsx`

Evidence:
- Category/menu/search suggestion thumbnails could use original image URLs.

Risk:
- Low. Images are decorative or thumbnail-sized.

Implementation:
- Added 56px, 72px, and 80px transforms for small UI imagery.
- Added explicit dimensions and lazy/async decoding.

### P1: Third-party startup blocking

Affected file:
- `frontend/index.html`

Evidence:
- GTM, Google Ads tag, and Meta Pixel were initialized in the document head before the app script.
- Lighthouse reported render-blocking work, high TBT, and main-thread pressure.

Risk:
- Medium. Analytics still loads, but pageview timing moves to idle, first interaction, scroll, or a 3.5s timeout.

Implementation:
- Replaced immediate third-party script startup with a deferred loader.
- Marketing scripts load on first `pointerdown`, `keydown`, `touchstart`, `scroll`, or idle timeout.
- Existing noscript fallbacks were preserved.

### P1: Accessibility landmark

Affected file:
- `frontend/src/pages/Home.tsx`

Evidence:
- Lighthouse reported a missing main landmark.

Risk:
- Low.

Implementation:
- Wrapped storefront content in `<main id="main-content">`.
- Kept footer outside the main landmark.

## Performance Budget

Starting budget for future enforcement:

| Resource | Target |
| --- | ---: |
| Initial JS gzip | <= 200-250 kB practical target |
| Initial CSS gzip | <= 50 kB |
| Mobile LCP image | <= 150-250 kB where visual quality permits |
| Initial mobile transfer | <= 1.5-2.0 MB practical target |
| Startup third-party JS | Load after first paint/intent unless business critical |

## Remaining P0/P1 Work

- Run Lighthouse/WebPageTest on a deployed preview to confirm the actual LCP node and transferred image bytes.
- Split the home route further: `HomeExperience.tsx` currently imports below-fold bundle code alongside above-fold `PurposeDiscovery`.
- Audit API payload size for `/products` and `/categories`; homepage cards do not need full product detail payloads.
- Consider a first-viewport home data endpoint that returns hero, categories, and a few featured products only.
- Investigate CSS pruning; CSS is acceptable gzip size but high raw size due global/admin styles.
