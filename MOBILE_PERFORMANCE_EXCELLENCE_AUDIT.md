# BrajMart Mobile Performance Excellence Audit

Date: 2026-09-23

## Evidence boundary

The authoritative baseline is the supplied real PageSpeed Insights result: mobile Performance 71, FCP 3.3 s, LCP 4.8 s, TBT 100 ms, Speed Index 5.6 s, CLS 0, Accessibility 93, Best Practices 100, SEO 100; desktop Performance 98, Accessibility 96, Best Practices 100, SEO 100. The changed build was not deployed, so final measurements are Lighthouse 13.5.0 built-preview results and are not presented as new PSI scores. This workstation reports a slower-than-reference CPU and materially inflates local TBT.

## Production trace diagnosis

One Lighthouse 13.5.0 trace of production reproduced the requested findings at request/node level. Its score is not used as the baseline.

### Render blockers

| URL | Type | Transfer | Duration / opportunity | Party | Above-fold requirement | Disposition |
| --- | --- | ---: | ---: | --- | --- | --- |
| `fonts.googleapis.com/css2?...` | CSS | 2,320 B | 931 ms request; render-blocking insight contributor | Third party | Fonts useful, stylesheet blocking not required | Load as preloaded stylesheet with onload promotion and noscript fallback |
| `/assets/index-BoFdDL3_.css` | CSS | 26,055 B | Remaining first-party stylesheet | First party | Yes | Keep blocking; deferring the complete Tailwind bundle risks FOUC/CLS |

The reproduced production trace estimated 520 ms render-blocking savings; the supplied PSI result estimated about 860 ms. The discrepancy is normal run variance. In the final mobile median run Lighthouse reported no render-blocking opportunity. The app stylesheet appeared as a 40 ms desktop opportunity in two runs and no opportunity in one.

### LCP element and phases

The production LCP was the first `HeroCarousel` image (`alt="Accessory"`), rendered at 348 x 122 CSS px. It was present in initial HTML with real `src`, `srcset`, `sizes="100vw"`, width/height, `loading="eager"`, and `fetchpriority="high"`. Lighthouse passed all discovery checks; it did not wait for React, an API response, or carousel initialization.

Production trace phase details were: TTFB 203 ms, load delay 61 ms, load duration 812 ms, and element render delay 863 ms. This identified CSS/font gating and render delay as higher-confidence work than another hero architecture rewrite.

The production trace selected ImageKit `w-768,h-269,c-at_least,q-74,f-webp`, transferring 45,672 bytes. Existing checks cover 360/390/430 CSS px: DPR 1 selects 480px and DPR 2 selects 768/960px. A direct ImageKit comparison returned WebP 45,672 B and AVIF 44,761 B, only 911 B (2.0%) smaller, so AVIF hardcoding was rejected.

### Network dependency tree

The production longest chain was document -> Google Fonts CSS -> Playfair font, ending around 2,181 ms. Google Fonts transferred 89,897 B (CSS plus Inter and Playfair). The async stylesheet change removes that chain from render blocking without removing the brand fonts or their `font-display=swap` behavior.

The final median mobile run transferred 681,356 B: document 53,756 B; CSS 28,348 B; JavaScript 168,300 B; images 339,641 B; fonts 87,577 B; API fetches 780 B; other 2,954 B. Fonts still download, but no longer gate rendering.

### Forced reflow, long tasks, and third parties

Production forced reflow was 33.2 ms, primarily carousel/React layout work. It was absent from the final median run's failing insights, so no carousel rewrite was justified. The final local mobile median contained 13 long-task records under the workstation's slow CPU calibration; the supplied PSI TBT of 100 ms remains the authoritative deployed baseline.

Marketing scripts remained deferred beyond the critical startup window. In the median final trace, third-party transfer was ImageKit 213,062 B, Google Fonts 89,897 B, and Unsplash 126,579 B, with no reported third-party main-thread time.

## Implemented optimizations

### Non-render-blocking font stylesheet

PROBLEM: Google Fonts CSS was the dominant render-blocking request.

PAGESPEED EVIDENCE: Supplied opportunity about 860 ms; reproduced production trace 520 ms total render-blocking opportunity and a 931 ms font stylesheet request.

TRACE EVIDENCE: Longest network chain ended in Playfair at about 2,181 ms.

ROOT CAUSE: A synchronous external stylesheet blocked first paint even though fallback fonts and `display=swap` were available.

IMPLEMENTATION: Changed the font CSS link to `rel=preload as=style` with onload stylesheet promotion and a noscript stylesheet fallback.

FILES CHANGED: `frontend/index.html`.

MEASURED IMPACT: Google Fonts disappeared from the render-blocking audit; the final mobile median reported no render-blocking opportunity.

ACCESSIBILITY/SEO/COMMERCE: No semantic, content, route, or commerce changes.

VALIDATION: Lighthouse, full build, SEO, hydration/responsive smoke, and checkout tests.

### Confirmed accessibility repairs

PROBLEM: Production Lighthouse reported 55 contrast failures and two overlapping touch targets.

TRACE EVIDENCE: Failing pairs were saffron/gold text and controls on light surfaces, white on `#388e3c`, `#878787` on cream, carousel controls overlapping the secondary CTA, and WhatsApp overlapping the mobile bottom navigation.

IMPLEMENTATION: Darkened saffron/gold tokens, product rating/discount green, and original-price gray; hid overlapping carousel controls below `sm` while preserving automatic rotation and desktop controls; forced the existing mobile WhatsApp bottom offset to win over Tailwind's utilities layer.

FILES CHANGED: `frontend/src/index.css`, `frontend/src/components/product/ProductCard.tsx`, `frontend/src/components/hero/HeroCarousel.tsx`.

MEASURED IMPACT: Final mobile contrast, touch-target, and identical-link audits all passed; mobile Accessibility was 100 in all three runs.

COMMERCE RISK: None; product links, prices, cart, checkout, payment, and inventory behavior were unchanged.

## Rejected changes

- Critical CSS duplication: the remaining stylesheet is first-party and generally no longer flagged on mobile; duplicating Tailwind output would add maintenance and FOUC risk.
- Deferring the full application stylesheet: rejected because it would visibly flash and risk CLS.
- Responsive hero preload: discovery already passes all Lighthouse checks, so a preload could duplicate or over-prioritize downloads.
- AVIF hardcoding: only 911 B smaller for the audited hero candidate.
- Hero quality reduction: the remaining saving did not justify storefront image degradation.
- Forced-reflow rewrite: the small production finding disappeared from the final median critical findings.
- Broad JavaScript, Zustand, hydration, DOM, API, or SQL work: unsupported by the supplied 100 ms PSI TBT and explicitly outside scope.

## Validation notes

- Responsive checks passed at 320, 360, 390, 430, 768, 1024, 1280, 1440, and 1920 with no document overflow.
- Temporary API 500 responses were observed during multi-route hydration probing; prerendered homepage content remained available, responsive checks had no console errors, and the catalog-backed final build succeeded when the API recovered.
- A parallel checkout run had one timing failure; the scenario passed alone and the full seven-test suite passed serially.
- Lighthouse's Windows profile cleanup emitted `EPERM` after valid reports were written; every retained report has `runtimeError: null`.
