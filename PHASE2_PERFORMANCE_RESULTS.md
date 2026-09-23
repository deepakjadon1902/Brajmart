# BRAJMART PERFORMANCE ENGINEERING - PHASE 2 RESULTS

Date: 2026-09-23

## Lighthouse / Lab Metrics

Live Lighthouse was not run from this environment. Missing values are intentionally marked `NOT MEASURED`.

| Metric | Original Mobile | Phase 2 Mobile | Change | Original Desktop | Phase 2 Desktop | Change |
|---|---:|---:|---:|---:|---:|---:|
| Performance | 33 | NOT MEASURED | NOT MEASURED | 57 | NOT MEASURED | NOT MEASURED |
| FCP | 5.1 s | NOT MEASURED | NOT MEASURED | 0.8 s | NOT MEASURED | NOT MEASURED |
| LCP | 12.5 s | NOT MEASURED | NOT MEASURED | 2.2 s | NOT MEASURED | NOT MEASURED |
| TBT | 1,590 ms | NOT MEASURED | NOT MEASURED | 770 ms | NOT MEASURED | NOT MEASURED |
| Speed Index | 7.0 s | NOT MEASURED | NOT MEASURED | 2.0 s | NOT MEASURED | NOT MEASURED |
| CLS | 0.006 | NOT MEASURED | NOT MEASURED | 0.062 | NOT MEASURED | NOT MEASURED |
| JS execution | ~3.1 s | NOT MEASURED | NOT MEASURED | ~1.8 s | NOT MEASURED | NOT MEASURED |
| Main-thread work | ~5.9 s | NOT MEASURED | NOT MEASURED | ~3.4 s | NOT MEASURED | NOT MEASURED |
| Unused JS | ~230 KiB | NOT MEASURED | NOT MEASURED | ~229 KiB | NOT MEASURED | NOT MEASURED |
| Initial transfer | ~7,138 KiB | NOT MEASURED | NOT MEASURED | ~7,140 KiB | NOT MEASURED | NOT MEASURED |
| Request count | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Long tasks | 13 | NOT MEASURED | NOT MEASURED | 10 | NOT MEASURED | NOT MEASURED |

## Bundle Before vs After

Phase 2 baseline is the Phase 1 build state.

| Asset | Phase 1 Baseline | Phase 2 Final | Change |
|---|---:|---:|---:|
| HTML gzip | 1.83 kB | 1.84 kB | +0.01 kB |
| CSS gzip | 25.70 kB | 25.70 kB | 0 |
| Main app JS gzip | 85.33 kB | 85.44 kB | +0.11 kB |
| React/vendor gzip | 53.16 kB | 53.16 kB | 0 |
| Query/Zustand gzip | 10.06 kB | 10.06 kB | 0 |
| CartDrawer lazy chunk gzip | 2.36 kB | 2.36 kB | no size change; no longer loaded at startup |

Rejected experimental split:

| Asset | Experimental Lazy Home Split |
|---|---:|
| Main app JS gzip | 75.34 kB |

The experimental split was rejected because it caused hydration errors.

## Startup Resource Smoke

Local preview homepage script resources after Phase 2:

```text
index-CD_60oj9.js
gtm.js?id=GTM-PBFHQWC4
js?id=AW-17517087439
fbevents.js
```

Result:

| Check | Result |
|---|---|
| `CartDrawer-*` loaded at homepage startup | No |
| `main#main-content` count | 1 |
| SEO verification | Passed |
| Hydration page errors | Present: React #418/#423 |

## Major Change Reports

### Cart Drawer Runtime Deferral

PROBLEM:
`CartDrawer` was lazy-imported but rendered unconditionally under `Suspense`, so the lazy chunk could load during normal page startup.

EVIDENCE:
`App.tsx` always rendered `<CartDrawer />` inside `Suspense`.

ROOT CAUSE:
Lazy import alone does not defer runtime work when the lazy component is rendered immediately.

IMPLEMENTATION:
Added `StorefrontCartDrawer`, which subscribes only to `drawerOpen` and renders the lazy drawer only when open.

FILES:
`frontend/src/App.tsx`

BEFORE:
Cart drawer lazy boundary was present on every storefront page render.

AFTER:
Cart drawer code loads on cart drawer intent.

RISK:
Low. Cart count and cart store behavior remain immediate; drawer UI may appear after a tiny first-open chunk load.

VALIDATION:
Preview resource smoke confirmed no `CartDrawer-*` script during initial homepage load.

### ProductCard Wishlist Subscription Narrowing

PROBLEM:
Each product card subscribed to the entire wishlist store.

EVIDENCE:
`ProductCard` used `const { toggleItem, isInWishlist } = useWishlistStore();`.

ROOT CAUSE:
Whole-store subscriptions can cause many visible product cards to re-render for unrelated wishlist store changes.

IMPLEMENTATION:
Subscribed separately to `toggleItem` and the card-specific `items.some(...)` boolean.

FILES:
`frontend/src/components/product/ProductCard.tsx`

BEFORE:
Every product card observed the whole wishlist store.

AFTER:
Each card observes only what it needs.

RISK:
Low.

VALIDATION:
Focused eslint passed; tests passed.

### Home Store Subscription Narrowing

PROBLEM:
`Home` subscribed to the whole product store object.

EVIDENCE:
`Home` destructured `products`, `categories`, and methods from `useProductStore()`.

ROOT CAUSE:
Whole-store subscriptions can rerender home on unrelated store fields such as loading/error/lastFetchedAt.

IMPLEMENTATION:
Changed to narrow selectors for `products`, `categories`, and `getProductsByCategory`; derived bestseller/accessory arrays from `products`.

FILES:
`frontend/src/pages/Home.tsx`

BEFORE:
Whole-store subscription.

AFTER:
Field-specific subscriptions.

RISK:
Low.

VALIDATION:
Focused eslint passed; build and tests passed.

### Navbar Scroll Work Reduction

PROBLEM:
The sticky header called `setScrolled` on every scroll event.

EVIDENCE:
`Navbar` scroll listener directly ran `setScrolled(window.scrollY > 80)`.

ROOT CAUSE:
Repeated state calls add avoidable work during scroll, even when React bails out for identical booleans.

IMPLEMENTATION:
Added a ref gate so React state changes only when crossing the `80px` threshold.

FILES:
`frontend/src/components/layout/Navbar.tsx`

BEFORE:
State setter called on each scroll event.

AFTER:
State setter only called when threshold state changes.

RISK:
Low.

VALIDATION:
Focused eslint passed; preview smoke loaded homepage.

### PurposeDiscovery Module Split

PROBLEM:
Above-fold `PurposeDiscovery` lived in the same module as below-fold HomeExperience code.

EVIDENCE:
`HomeExperience.tsx` contained `PurposeDiscovery`, `BundledFavorites`, `BrajStory`, and newsletter/why sections.

ROOT CAUSE:
Mixed critical and below-fold concerns made later code-splitting harder and increased coupling.

IMPLEMENTATION:
Moved `PurposeDiscovery` to `frontend/src/components/sections/PurposeDiscovery.tsx`.

FILES:
`PurposeDiscovery.tsx`, `HomeExperience.tsx`, `Home.tsx`.

BEFORE:
Above-fold and below-fold home features shared one module.

AFTER:
Above-fold purpose grid has its own module.

RISK:
Low; markup preserved.

VALIDATION:
SEO verification and build passed.

## Regression Found And Fixed

An attempted lazy loading of below-fold homepage sections reduced main JS to `75.34 kB gzip`, but preview smoke produced React hydration errors. The change was rejected and removed. This preserved prerender/SEO stability over bundle-size optics.

## Verification

Passed:
- `npm run build`
- `npm test`
- `npm run verify:seo`
- Focused eslint on changed files
- Preview startup resource smoke

Not passed / known:
- Full repo lint remains blocked by pre-existing unrelated lint debt.
- Preview smoke reports existing React hydration errors #418/#423. Phase 2 did not resolve this; a risky attempted lazy hydration change was removed.

## Recommended Phase 3

Phase 3 should focus on measurement and hydration reliability before more splitting:

1. Run production-like Lighthouse/WebPageTest with request/long-task traces.
2. Decode and fix React hydration mismatches (#418/#423) in the prerender pipeline.
3. After hydration is clean, revisit below-fold island/lazy hydration safely.
4. Convert `.shimmer::after` from `left` animation to transform-based animation if confirmed as the Lighthouse non-composited animation.
5. Consider backend-safe homepage payload shaping only with explicit API compatibility tests.
