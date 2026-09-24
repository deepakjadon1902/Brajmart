# BrajMart Final 90+ Performance Convergence Audit

Date: 2026-09-24

## Baseline

Authoritative supplied PageSpeed screenshots:

| Profile | Performance | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---:|---:|---:|---:|---:|
| Mobile | 82 | 96 | 100 | 100 | 2/3 |
| Desktop | 88 | 96 | 100 | 100 | 2/3 |

Local Lighthouse 13.5.0 production reproduction showed lower absolute performance than the screenshots, but confirmed the same protection gates and Agentic Browsing 2/3 condition.

## Production Lighthouse Median

| Metric | Mobile Median | Desktop Median |
|---|---:|---:|
| Performance | 48 | 79 |
| FCP | 2.83 s | 1.10 s |
| LCP | 5.75 s | 1.51 s |
| TBT | 1,298 ms | 292 ms |
| Speed Index | 3.90 s | 1.63 s |
| CLS | 0 | 0.005 |
| Accessibility | 96 | 96 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| Agentic Browsing | 2/3 | 2/3 |

## Root Causes

Mobile score loss was dominated by high TBT and slow LCP. Production traces showed large script evaluation/style-layout cost, with GTM/gtag/Meta scripts present during Lighthouse because scroll was treated as a marketing load trigger.

Desktop LCP was healthy. Desktop score variance was primarily TBT/main-thread variance, not image discovery or TTFB.

Hero LCP discovery was already correct: eager loading, `fetchpriority="high"`, discoverable in initial HTML, and not lazy-loaded. TTFB was healthy in local Lighthouse.

Agentic Browsing failed the `llms-txt` audit because Lighthouse reported: "File does not appear to contain any links."

Accessibility 96 was caused by a product out-of-stock badge contrast failure in production reports.

## Implemented Changes

- Removed `scroll` as an immediate marketing-script trigger while preserving pointer, touch, keyboard, and delayed idle loading.
- Removed unused description/stock/SKU/date fields from homepage list DTO serialization.
- Changed generated `llms.txt` URLs to explicit Markdown links.
- Added `/.well-known/ai-catalog.json` and `<link rel="ai-catalog">`.
- Added product-specific wishlist labels and `aria-pressed`.
- Improved product-card add-to-cart/out-of-stock accessible names.
- Darkened out-of-stock badge background to pass contrast.
- Added a deterministic footer home-link accessible name.

## Validation

Passed:

- `npm.cmd run build`
- `npm.cmd run verify:performance-budgets`
- `npm.cmd run verify:seo`
- `npm.cmd test`
- `backend: npm.cmd run build`
- Focused local Lighthouse gates: Accessibility 96, Best Practices 96, SEO 100, Agentic Browsing 100

Known local-only caveat: local build could not reach the live catalog API, so Vite preview had fallback content and API 500 console noise. Production builds with live API access are the authoritative target for final PSI confirmation.

