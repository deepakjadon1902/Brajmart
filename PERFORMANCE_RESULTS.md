# BrajMart Performance Results

Date: 2026-09-23

## Build Measurements

Measured with `npm run build` in `frontend`.

| Metric | Before Mobile | After Mobile | Before Desktop | After Desktop |
| --- | ---: | ---: | ---: | ---: |
| Lighthouse Performance | 33 supplied | Not measured locally | 57 supplied | Not measured locally |
| FCP | 5.1 s supplied | Not measured locally | 0.8 s supplied | Not measured locally |
| LCP | 12.5 s supplied | Not measured locally | 2.2 s supplied | Not measured locally |
| TBT | 1,590 ms supplied | Not measured locally | 770 ms supplied | Not measured locally |
| Speed Index | 7.0 s supplied | Not measured locally | 2.0 s supplied | Not measured locally |
| CLS | 0.006 supplied | Not measured locally | 0.062 supplied | Not measured locally |
| Main app JS gzip | 85.05 kB | 85.33 kB | 85.05 kB | 85.33 kB |
| React/vendor JS gzip | 53.16 kB | 53.16 kB | 53.16 kB | 53.16 kB |
| CSS gzip | 25.70 kB | 25.70 kB | 25.70 kB | 25.70 kB |
| HTML gzip | 1.70 kB | 1.84 kB | 1.70 kB | 1.84 kB |

## Optimizations Implemented

### Hero/LCP image

Problem: mobile hero used a fixed `1920x532` transform and raw slide preloads.

Root cause: the browser had no responsive image candidates and off-DOM preload work could duplicate downloads.

Fix: added `srcset`, `sizes`, dimensions, and removed raw preloading.

Why it works: mobile browsers can choose 480/768/960px ImageKit transforms instead of a 1920px image, while keeping the visible LCP image eager/high priority.

Measured impact: bundle size unchanged; expected production impact is lower hero image transfer and less network contention. Requires Lighthouse/network verification on preview.

### Product thumbnails

Problem: carousel cards rendered near 176-250px but requested 720px square thumbnails by default.

Root cause: one reusable square helper used an oversized default for all card contexts.

Fix: product cards now use 320px default below fold, `srcset`, and accurate `sizes`.

Why it works: card images now align with rendered dimensions and device pixel ratio.

Measured impact: bundle size unchanged; expected impact is reduced homepage image bytes, especially on mobile product rows.

### Third-party scripts

Problem: GTM, Google Ads, and Meta Pixel booted from the head during startup.

Root cause: analytics scripts competed with first render and main-thread startup.

Fix: load third-party marketing scripts on first interaction, scroll, idle callback, or timeout.

Why it works: first render and LCP get priority; analytics still initializes shortly after.

Measured impact: HTML gzip +0.14 kB. Expected impact is reduced render-blocking and startup main-thread contention.

### Accessibility

Problem: missing main landmark.

Root cause: homepage used layout divs without a `<main>`.

Fix: storefront content now sits inside `<main id="main-content">`; footer remains outside.

Measured impact: accessibility audit issue should be resolved; requires Lighthouse/aXe verification.

## Validation

Passed:
- `frontend`: `npm run build`

Build notes:
- Vite build succeeded.
- SSR build succeeded.
- Prerender succeeded for 19 public routes using fallback data because live catalog/blog API calls returned 404 in this environment.

Did not pass:
- `frontend`: `npm run lint`

Lint status:
- Fails on existing repository-wide lint debt, mostly `@typescript-eslint/no-explicit-any`, empty shadcn interfaces, and hook dependency warnings in unrelated files.
- The failure is not introduced by the performance image/script changes.

## Remaining Limitations

- Live Lighthouse was not run from this environment, so no synthetic score improvement is claimed.
- Actual transferred image byte savings depend on current production ImageKit source images and browser candidate selection.
- The homepage JS chunk remains about 85 kB gzip; further route/section splitting is the next JS-focused phase.
