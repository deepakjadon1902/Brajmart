# Brajmart Phase 8 Final Performance Audit

Date: 2026-09-23

## Scope and evidence boundary

This audit verifies the complete Phase 1-7 release candidate and the Phase 8 changes in the local production build. No authorized deployment workflow exists in the repository, so no deployment was executed and no post-release production Lighthouse result is claimed.

## Release candidate integrity

- Existing Phase 1 responsive ImageKit architecture, eager/high-priority hero, image sizes, lazy loading, and SEO output remain intact.
- Existing Phase 2-7 route splitting, deferred runtime work, React Query hydration, compact product list DTO, DOM controls, accessibility repairs, and intent-based cart prefetch remain intact.
- No payment, inventory, authentication, pricing, or order business logic was changed in Phase 8.
- The dirty worktree was inspected and preserved; no unrelated user work was reverted.

## Phase 8 root-cause evidence

The Phase 7 mobile Lighthouse trace attributed roughly 1,983 ms of the LCP to render delay, compared with about 39 ms TTFB, 53 ms load delay, and 791 ms image load duration. The selected mobile hero was already a responsive ImageKit asset, so further broad image-architecture changes were not justified. Startup CPU remained the larger constraint: first-party React boot work was about 2,054 ms in the inspected run, while Facebook and GTM introduced about 1,253 ms and 1,097 ms of blocking work after their timeout fallback.

Two startup behaviors were therefore corrected:

1. `HeroCarousel` no longer forces a duplicate slide fetch when server-rendered slides already exist, and automatic rotation starts after 8 seconds rather than replacing the LCP candidate at 3 seconds.
2. The no-interaction marketing fallback now begins after `load` plus 8 seconds and an idle opportunity. Pointer, keyboard, touch, and scroll intent still load marketing immediately, and the existing `dataLayer`, `gtag`, and Meta queue behavior is retained.

## Hero delivery verification

Playwright verified the first hero at 360, 390, and 430 CSS pixels. DPR 1 selected the 480px ImageKit candidate; DPR 2 selected 768px at 360 and 960px at 390/430. Every checked candidate retained `q-74`, `f-webp`, `loading=eager`, and `fetchpriority=high`. No raw JavaScript hero preload was reintroduced.

## Preview Lighthouse results

Three Lighthouse 12.8.2 runs were completed per profile against the built preview.

| Profile | Performance | FCP | LCP | TBT | CLS | Accessibility | SEO |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile median | 49 | 3.432 s | 5.014 s | 970 ms | 0.0151 | 92 | 100 |
| Desktop median | 90 | 0.668 s | 1.024 s | 215 ms | 0.0052 | 96 | 100 |

Run ranges were mobile Performance 48-51, LCP 4.996-5.136 s, TBT 928-970 ms; desktop Performance 89-92, LCP 1.019-1.026 s, TBT 188-231 ms. These are local preview results, not field data or deployed-production results.

## Runtime and interaction verification

- Independent startup instrumentation recorded desktop FCP/LCP 1,144 ms with seven long tasks and mobile FCP/LCP 608 ms with six long tasks under that harness.
- Five-run cart benchmark median: 1,175 ms without intent and 719 ms with intent, a measured 456 ms reduction. Median prefetch lead was 1,065 ms.
- Cart code remained absent at startup and loaded after cart intent/action.
- Responsive checks passed from 320 through 1920 pixels without document overflow.
- 82 homepage product cards remained under the 90-card budget; measured DOM was 3,917 nodes.
- Seven checkout safety scenarios passed after aligning selectors with the accessible button names introduced in Phase 7.

## API, cache, and database findings

The frontend build-time catalog fetch explicitly requests `/products?view=detail`; public runtime list consumers use the compact default representation; product detail routes use the detail endpoint. This is compatible with the backend's list/detail distinction and optional frontend product fields. No live database credentials or query-plan access were available, so SQL projection plans and index effectiveness are not claimed as measured. No database schema or index was changed.

## Analytics duplication

The inspected network showed direct application startup paths for GTM, Google Ads, and Meta. GTM also initiated a Google Ads `gtag` request, establishing overlapping script delivery paths. The evidence does not prove equivalent conversion events or identify a safe authoritative owner, so no tag was removed. Marketing startup was delayed without changing queue semantics.

## Release gates

- Frontend production build: pass, including 406 generated routes.
- Backend TypeScript build: pass.
- Unit tests: 7/7 pass.
- Checkout safety tests: 7/7 pass.
- Focused ESLint: 0 errors; 16 existing warnings in `App` fast-refresh exports and `ProductDetail` hook analysis.
- SEO verification: pass.
- Performance budgets: pass.

## Deployment and field status

DEPLOYMENT REQUIRED — NOT EXECUTED.

The repository has Vercel configuration but no checked-in, already-authorized deployment workflow or deployment command. Production therefore cannot yet be asserted to contain the release candidate. RUM has no configured destination, and field Core Web Vitals remain unmeasured. Earlier production evidence showed stale frontend/backend behavior and must not be conflated with the preview results above.

## Residual risks

- Mobile lab LCP and TBT remain above the desired final targets even after substantial improvement; React startup and the large rendered catalog remain the primary monitored costs.
- Third-party behavior after user interaction remains externally controlled.
- The external Render API returned intermittent 503 responses during one hydration check; rendered fallback content remained available, but production API availability requires operational monitoring.
- Lighthouse emitted Windows temporary-profile cleanup `EPERM` warnings after writing valid reports; report `runtimeError` was clear and metrics were present.
