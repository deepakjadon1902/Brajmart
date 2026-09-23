# Brajmart Final Performance Report

Date: 2026-09-23

## Program result

The eight-phase performance program produced a locally verified release candidate that preserves commerce behavior, SEO output, responsive image delivery, and accessibility while materially reducing preview startup blocking. The final built-preview medians are mobile Performance 49, LCP 5.014 s, TBT 970 ms and desktop Performance 90, LCP 1.024 s, TBT 215 ms. CLS remains low at 0.0151 mobile and 0.0052 desktop.

## What changed across the program

- Responsive ImageKit delivery replaced oversized fixed image requests while preserving an eager, high-priority hero.
- Route and component splitting removed deferred commerce UI from startup; intent prefetch recovers responsiveness before cart action.
- Homepage rendering, React Query hydration, and product API representations were constrained to reduce startup work and transfer.
- Marketing tags were moved off the critical startup window while preserving interaction-triggered loading and event queues.
- DOM, accessibility, SEO, responsive behavior, checkout flows, and performance budgets gained repeatable verification.
- Phase 8 removed a duplicate hero data refresh, stabilized the initial LCP candidate, and moved the passive marketing fallback beyond the critical audit window.

## Baseline context and final evidence

The original production baseline supplied at program start was mobile Performance 33, FCP 5.1 s, LCP 12.5 s, TBT 1,590 ms and desktop Performance 57, FCP 0.8 s, LCP 2.2 s, TBT 770 ms. Those figures and the final figures are not a controlled production before/after pair: the final measurements are three-run local built-preview medians because deployment was not authorized. No specific production improvement is claimed.

The final build contains 86.18 kB gzip main JavaScript, 25.63 kB gzip CSS, and a 2.36 kB gzip lazy CartDrawer chunk. All performance budgets pass. Frontend and backend builds, unit tests, checkout tests, SEO checks, and responsive checks pass.

## Release disposition

DEPLOYMENT REQUIRED — NOT EXECUTED.

No repository-defined authorized deployment workflow was found. After deployment by the authorized owner, the next operational actions are to verify the deployed commit and API representation, collect three production Lighthouse runs per profile, watch API 5xx rates, and enable a consent-compatible RUM destination for field LCP, INP, and CLS. These are release operations and monitoring, not an additional engineering phase.

## Known monitored items

- Mobile lab LCP and TBT still need field confirmation and remain the principal performance watch items.
- React startup and the 82-card homepage are the largest first-party runtime surfaces left.
- Google Ads can be initiated both directly and through GTM; ownership should be reconciled with the analytics owner before removing either path.
- SQL query plans and index use were not measured because database access was unavailable.
- Intermittent external API 503 responses require availability monitoring.

PERFORMANCE ENGINEERING PROGRAM: COMPLETE
