# Brajmart Phase 8 Final Performance Results

Date: 2026-09-23

## Outcome

The Phase 1-8 release candidate passes the local release gates. Deployment was not executed because no existing authorized deployment workflow is present.

## Lighthouse 12.8.2 medians (built preview, three runs)

| Metric | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | 49 | 90 |
| FCP | 3.432 s | 0.668 s |
| LCP | 5.014 s | 1.024 s |
| TBT | 970 ms | 215 ms |
| CLS | 0.0151 | 0.0052 |
| Accessibility | 92 | 96 |
| SEO | 100 | 100 |

Compared with the Phase 7 preview medians, mobile Performance rose from 41 to 49, LCP moved from 5.10 s to 5.014 s, and TBT fell from 3.06 s to 970 ms. Desktop Performance rose from 69 to 90, LCP moved from 1.15 s to 1.024 s, and TBT fell from 718 ms to 215 ms. This comparison is lab-to-lab and does not claim production or field improvement.

## Build and budgets

| Asset / surface | Result | Budget |
| --- | ---: | ---: |
| Main JS | 275.22 kB raw / 86.18 kB gzip | raw <= 285 kB |
| CSS | 147.34 kB raw / 25.63 kB gzip | raw <= 155 kB |
| HTML shell | 5.44 kB raw / 1.91 kB gzip | informational |
| CartDrawer chunk | 6.49 kB raw / 2.36 kB gzip | raw <= 8 kB |
| Homepage gzip transfer model | 53.409 kB | <= 60 kB |
| Product cards | 82 | <= 90 |
| DOM nodes | 3,917 | <= 4,500 |

## Interaction results

CartDrawer remained excluded from startup. Five-run median cart-open latency was 1,175 ms direct and 719 ms after intent prefetch, an improvement of 456 ms with 1,065 ms median lead time. Checkout safety passed 7/7 scenarios.

## Validation summary

- Frontend build: PASS
- Backend build: PASS
- Unit tests: PASS (7/7)
- Checkout safety: PASS (7/7)
- Focused ESLint: PASS with 0 errors (16 existing warnings)
- SEO verification: PASS
- Responsive 320-1920: PASS
- Performance budgets: PASS
- Payment/inventory logic changes: NONE
- Deployment: REQUIRED — NOT EXECUTED
- Production Lighthouse after release: NOT MEASURED
- Field Core Web Vitals/RUM: NOT MEASURED
