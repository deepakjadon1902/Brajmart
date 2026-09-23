# BrajMart Performance Engineering - Phase 2 Audit

Date: 2026-09-23

## Scope

Phase 2 targeted JavaScript execution, main-thread pressure, startup architecture, rerender behavior, route/runtime loading, forced reflow, and third-party/runtime cost. Phase 1 image and third-party deferral work was preserved.

## Startup Dependency Graph

Homepage startup path:

`index.html`
-> `src/main.tsx`
-> global providers in `App.tsx`
-> route table
-> `/` `Home.tsx`
-> `AnnouncementBar`, `Navbar`, `CategoryNavbar`
-> `HeroCarousel`
-> `TrustBar`
-> `PurposeDiscovery`
-> below-fold collection sections, home experience sections, footer, floating WhatsApp.

Key findings:

| Branch | Above fold | Startup required | Can defer safely | Notes |
| --- | --- | --- | --- | --- |
| Header/nav/search shell | Yes | Yes | No | Search input must remain responsive. |
| Hero | Yes | Yes | No | Phase 1 LCP path preserved. |
| PurposeDiscovery | Near first viewport | Yes | No | Kept crawlable and immediate. |
| Collection sections | Below fold | SSR content yes | Runtime deferral risky | Lazy runtime deferral caused hydration errors in preview. |
| CartDrawer | Hidden until intent | No | Yes | Safe to load only when drawer opens. |
| HomeExperience bundle shelf | Below fold | SSR content yes | Data fetch can wait until component renders | Existing deferred mount keeps SSR stable. |
| Footer/social rail | Below fold | SSR content yes | Runtime lazy rejected for hydration stability | React-icons cost remains for later phase if needed. |

## Bundle Findings

Phase 1 baseline:

| Asset | Phase 1 |
| --- | ---: |
| Main app JS | 272.64 kB raw / 85.33 kB gzip |
| CSS | 147.65 kB raw / 25.70 kB gzip |
| HTML | 5.16 kB raw / 1.83 kB gzip |

Final Phase 2 build:

| Asset | Phase 2 |
| --- | ---: |
| Main app JS | 272.97 kB raw / 85.44 kB gzip |
| CSS | 147.65 kB raw / 25.70 kB gzip |
| HTML | 5.16 kB raw / 1.84 kB gzip |
| CartDrawer lazy chunk | 6.49 kB raw / 2.36 kB gzip |

Notes:
- A more aggressive homepage lazy-section split briefly reduced main app JS to 239.72 kB raw / 75.34 kB gzip.
- That approach caused React hydration errors in preview, so it was rejected and removed.
- Final bundle size is essentially flat, but initial runtime no longer renders the cart drawer lazy component on every page.

## Long-Task Findings

Live long-task profiling was not available in this environment. Code inspection found likely contributors:

- Homepage initializes many below-fold sections to preserve prerender/hydration.
- Product cards subscribed to the entire wishlist store.
- Navbar scroll handler called React state on every scroll event.
- CartDrawer imported Framer Motion, recommendation logic, and cart UI code; although code-split, it was rendered unconditionally in `App`, causing lazy chunk loading at startup.

## React Rendering Findings

Implemented:
- `ProductCard` now subscribes only to `toggleItem` and a per-product wishlist boolean.
- `Home` now uses narrow `useProductStore` selectors rather than subscribing to the entire product store.
- Derived best-seller/accessory lists are calculated from `products` with explicit memoization.
- Navbar scroll state updates only when crossing the threshold.

Rejected:
- Broad memoization of cards/sections. No profiling evidence justified blanket `React.memo`.

## React Query Findings

React Query is globally configured, but the homepage primarily uses Zustand stores and direct API helpers. No Phase 2 React Query changes were made.

## API Waterfall Findings

Observed from code:
- `App` refreshes public settings on mount.
- `App` schedules product/category refresh during idle for storefront paths.
- `HeroCarousel` fetches hero slides and refreshes periodically.
- `BundledFavorites` fetches bundles only when its component renders.
- Cart and wishlist remote loads only run when authenticated.

No backend contract changes were made because product/inventory/payment correctness is business-critical.

## Third-Party Findings

Phase 1 deferred GTM, Google Ads, and Meta Pixel. Phase 2 startup resource smoke showed marketing scripts still load after idle/timeout, not from the static head.

Razorpay was not found in homepage startup code; payment APIs remain checkout/payment-path scoped.

## Forced-Reflow Findings

Search found only one direct layout read:

- `GoogleSignInButton.tsx` reads `offsetWidth` to size the Google button. This is auth-route scoped, not homepage startup.

No homepage read/write layout-thrashing loop was found.

## Animation Findings

Framer Motion is present in many route chunks and in `CartDrawer`. The homepage itself does not import Framer Motion directly. Phase 2 prevents CartDrawer/Framer Motion drawer runtime from loading until drawer open.

CSS animation finding:
- `.whatsapp-float` uses transform animation, which is compositor-friendly.
- `.shimmer::after` animates `left`; this may be the non-composited animation reported by Lighthouse. It appears in shared CSS and was documented for a safer visual follow-up rather than changed blindly in this pass.

## Changes Implemented

1. Cart drawer load-on-open:
   - `App.tsx` now renders `CartDrawer` only when `drawerOpen` is true.
   - Startup resource smoke confirmed `CartDrawer-*` is not loaded on initial homepage load.

2. Product card store subscription narrowing:
   - `ProductCard` no longer subscribes to the entire wishlist store.

3. Homepage product store subscription narrowing:
   - `Home` no longer subscribes to the entire product store object.

4. Header scroll handler gating:
   - `Navbar` only calls `setScrolled` when the threshold boolean changes.

5. Above-fold module separation:
   - `PurposeDiscovery` moved to its own file so it is not coupled to below-fold bundle/recommendation code.

6. DeferredMount safety:
   - Added an opt-in `deferUntilVisible` prop, but preserved prerender hydration behavior when initial data exists.

## Changes Intentionally Not Implemented

- Homepage below-fold lazy hydration: rejected because preview smoke produced React hydration errors.
- Backend product payload redesign: deferred due business correctness and contract risk.
- Broad `React.memo` / `useMemo` / `useCallback`: rejected without profiling evidence.
- Full footer lazy split: rejected because the footer is statically imported by many lazy routes and Vite warned it would not be cleanly moved.
- Non-composited shimmer rewrite: documented for follow-up because it is a visual design change and not proven as the exact Lighthouse culprit locally.

## Risks

- Existing production build preview reports React hydration errors (#418/#423). Phase 2's unsafe lazy attempt also triggered them, was removed, and remaining Phase 2 changes do not alter initial SSR markup meaningfully. This should be investigated as a dedicated prerender/hydration reliability task.
- Main bundle size did not materially decrease in the final safe implementation.

## Verification

Passed:
- `npm run build`
- `npm test`
- `npm run verify:seo`
- Focused eslint for Phase 1/2 changed TS/TSX files
- Preview smoke: homepage loads, one `main#main-content`, no startup `CartDrawer-*` script

Known issues:
- Preview smoke reports React hydration page errors #418/#423.
- External scripts/images show network-denied errors in the local sandboxed browser.
- Full `npm run lint` still has pre-existing repository-wide lint debt unrelated to Phase 2.
