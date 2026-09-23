# BrajMart Performance Engineering - Phase 1 Audit

Date: 2026-09-23

## Original Baseline

Owner-supplied PageSpeed baseline:

| Metric | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 33 | 57 |
| Accessibility | 90 | 90 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |
| FCP | 5.1 s | 0.8 s |
| LCP | 12.5 s | 2.2 s |
| TBT | 1,590 ms | 770 ms |
| Speed Index | 7.0 s | 2.0 s |
| CLS | 0.006 | 0.062 |
| Total network payload | 7,138 KiB | 7,140 KiB |

## Architecture Map

Critical startup path:

`index.html`
-> `src/main.tsx`
-> `HelmetProvider`, `ThemeProvider`, `BrowserRouter`, `ErrorBoundary`
-> `App.tsx`
-> `QueryClientProvider`, `TooltipProvider`, global toasters, route SEO
-> `/` route
-> `Home.tsx`
-> `AnnouncementBar`, `Navbar`, `CategoryNavbar`
-> `HeroCarousel`
-> `TrustBar`, `PurposeDiscovery`
-> deferred home sections and footer.

SSR/prerender path:

`npm run build`
-> Vite client build
-> Vite SSR build for `src/entry-server.tsx`
-> `scripts/prerender-pages.mjs`
-> `scripts/generate-llms.mjs`
-> `scripts/generate-sitemap.mjs`.

Caching:

`frontend/vercel.json` already sets `Cache-Control: public, max-age=31536000, immutable` for `/assets/(.*)`. Public SEO/static files use `max-age=3600, stale-while-revalidate=86400`. No cache header change was needed for Phase 1.

## Build Baseline

Initial local production build before Phase 1 edits:

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| `dist/index.html` | 4.60 kB | 1.70 kB |
| `dist/assets/index-*.css` | 147.65 kB | 25.70 kB |
| `dist/assets/index-*.js` | 271.80 kB | 85.05 kB |
| `dist/assets/react-*.js` | 162.97 kB | 53.16 kB |
| `dist/assets/proxy-*.js` | 111.67 kB | 36.74 kB |
| `dist/assets/icons-*.js` | 43.38 kB | 8.10 kB |
| `dist/assets/carousel-*.js` | 22.06 kB | 8.87 kB |

## P0 - LCP/Hero Image Delivery

PROBLEM:
Homepage hero image delivery was likely overfetching on mobile.

EVIDENCE:
`HeroCarousel` rendered the visible image with one fixed ImageKit transform: `w-1920,h-532`. Lighthouse reported mobile LCP at 12.5 s, LCP request discovery issues, and image savings near 3,964 KiB.

ROOT CAUSE:
Mobile browsers had no responsive candidates and were forced toward a desktop-sized transformed image. The component also used JavaScript-created raw image preloads for the first two slides.

PROPOSED IMPLEMENTATION:
Use `srcset`/`sizes`, keep only the visible LCP candidate eager/high priority, remove raw slide preloading, and add intrinsic dimensions.

RISK:
Low. Same image source and visible layout are preserved.

VALIDATION METHOD:
Build, SEO prerender verification, and future network inspection at 360/390/1440 px to confirm selected candidates.

## P0 - Product Thumbnail Payload

PROBLEM:
Product cards requested thumbnails larger than their rendered size.

EVIDENCE:
Carousel cards render around `176-250px`, while `toSquareImageUrl` defaulted to `720px`.

ROOT CAUSE:
A generic square-image helper was used for small product cards without a card-specific responsive strategy.

PROPOSED IMPLEMENTATION:
Use `320px` fallback for regular cards and responsive candidates `220, 320, 480`; use larger `320, 480, 640` only for priority first-row cards.

RISK:
Low. High-density displays still get larger candidates.

VALIDATION METHOD:
Build and responsive browser/network verification.

## P1 - Navigation/Search/Category Images

PROBLEM:
Small UI images could use full original URLs.

EVIDENCE:
Search suggestion thumbnails and category icons used raw URLs in places.

ROOT CAUSE:
Small thumbnails did not consistently pass through the ImageKit-aware transform helper.

PROPOSED IMPLEMENTATION:
Apply 56px, 72px, and 80px transforms with explicit dimensions.

RISK:
Low.

VALIDATION METHOD:
Build and visual check of nav/category/search images.

## P1 - Third-Party Startup

PROBLEM:
GTM, Google Ads, and Meta Pixel initialized directly in the document head.

EVIDENCE:
`index.html` loaded marketing scripts before application startup. Lighthouse reported render-blocking requests, high TBT, and third-party impact.

ROOT CAUSE:
Third-party scripts competed with first render and LCP.

PROPOSED IMPLEMENTATION:
Defer marketing script injection to first user interaction, scroll, idle callback, or a timeout fallback. Preserve noscript fallbacks and integrations.

RISK:
Medium. Analytics pageview timing changes from immediate to idle/interaction/timeout.

VALIDATION METHOD:
Build, SEO verification, and runtime check that scripts load after interaction/idle.

## P2 - Accessibility

PROBLEM:
Lighthouse reported a missing main landmark.

EVIDENCE:
`Home.tsx` used a root div and sections without a `<main>`.

ROOT CAUSE:
Page landmark structure was incomplete.

PROPOSED IMPLEMENTATION:
Wrap storefront content in `<main id="main-content">` and keep `Footer` outside.

RISK:
Low.

VALIDATION METHOD:
SEO verification and future Lighthouse/aXe run.

## Out Of Scope For Phase 1

- Deep React memoization.
- Large Zustand or React Query redesign.
- Backend product payload redesign.
- Major homepage route architecture split.
- Database/index changes.
- Lighthouse score claims without live measurement.

## Phase 1 Budget

| Budget Item | Guardrail |
| --- | ---: |
| LCP | <= 2.5 s long term |
| CLS | <= 0.1 |
| Mobile LCP image | Prefer 150-250 KiB where quality allows |
| Initial mobile transfer | Reduce from 7.1 MB, aspirational <= 2 MB |
| Initial JS gzip | Keep practical path toward <= 200-250 kB |
| Startup third-party JS | Defer unless business critical before interaction |
