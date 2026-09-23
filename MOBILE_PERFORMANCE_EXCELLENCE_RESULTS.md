# BrajMart Mobile Performance Excellence Results

Date: 2026-09-23

## Authoritative before baseline

| Profile | Performance | FCP | LCP | TBT | Speed Index | CLS | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile PSI | 71 | 3.3 s | 4.8 s | 100 ms | 5.6 s | 0 | 93 | 100 | 100 |
| Desktop PSI | 98 | not supplied | healthy | not supplied | not supplied | not supplied | 96 | 100 | 100 |

## Final Lighthouse 13.5.0 built-preview runs

| Mobile run | Performance | FCP | LCP | TBT | Speed Index | CLS | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 52 | 2.551 s | 5.062 s | 1,242 ms | 3.824 s | 0.0151 | 100 | 96 | 100 |
| 2 | 52 | 3.408 s | 4.990 s | 797 ms | 5.470 s | 0.0151 | 100 | 96 | 100 |
| 3 | 46 | 3.424 s | 5.098 s | 1,219 ms | 5.736 s | 0.0151 | 100 | 96 | 100 |
| Median | 52 | 3.408 s | 5.062 s | 1,219 ms | 5.470 s | 0.0151 | 100 | 96 | 100 |

| Desktop run | Performance | FCP | LCP | TBT | Speed Index | CLS | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 74 | 0.689 s | 1.048 s | 592 ms | 1.155 s | 0.0043 | 96 | 96 | 100 |
| 2 | 86 | 0.658 s | 1.193 s | 278 ms | 1.139 s | 0.0052 | 96 | 96 | 100 |
| 3 | 92 | 0.667 s | 1.010 s | 192 ms | 1.100 s | 0.0052 | 96 | 96 | 100 |
| Median | 86 | 0.667 s | 1.048 s | 278 ms | 1.139 s | 0.0052 | 96 | 96 | 100 |

These preview scores are not directly comparable to PSI: this workstation is CPU-constrained, and the local preview logs API/localhost console errors that lower Best Practices. The change cannot have a new real PSI result until deployed. The request-level outcome is deterministic: Google Fonts no longer blocks rendering, final mobile contrast/touch audits pass, and SEO remains 100.

## Render path before and after

| Finding | Before | Final built preview |
| --- | --- | --- |
| Render-blocking opportunity | PSI about 860 ms; reproduced production 520 ms | None in all three mobile runs |
| Blocking font CSS | 2,320 B, 931 ms request | Still fetched, no longer render blocking |
| Mobile accessibility | 93 | 100 median (100 in every run) |
| Contrast audit | Fail, 55 nodes | Pass |
| Touch-target audit | Fail, 2 nodes | Pass |
| Identical-link audit | Pass/informational | Pass |
| Hero discovery | Discoverable/eager/high priority | Preserved |
| Hero format | WebP 45,672 B | Preserved; AVIF saved only 911 B |

## Release gates

- Frontend production build: PASS, 406 routes including 346 products and 36 category routes.
- Backend TypeScript build: PASS.
- Vitest: PASS, 7/7.
- Checkout Playwright: PASS, 7/7 serially.
- Responsive validation: PASS, 320-1920 with no document overflow.
- SEO verification: PASS.
- Focused ESLint: PASS, zero errors.
- Performance budgets: PASS: main JS 275,183 B; CSS 147,437 B; CartDrawer 6,487 B; homepage gzip 53,448 B; 82 cards; estimated DOM 3,919.
- CartDrawer lazy startup and intent prefetch: preserved.
- Payment, inventory, authentication, pricing, orders, reviews, and admin logic: unchanged.

## Status

The safe critical-rendering and accessibility changes are complete. A new production PSI comparison requires deployment through the project's authorized deployment owner; no deployment was performed in this task.
