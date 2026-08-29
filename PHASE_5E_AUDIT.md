# BrajMart Phase 5E Audit

Audit date: 2026-08-29

Scope: storefront product discovery, product detail conversion, cart and checkout experience, recommendations, bundles, wishlist, recently viewed, reviews, analytics, admin merchandising, accessibility, performance, security, SEO, and database safety. This audit is based on the repository implementation, not assumptions from the Phase 5E prompt.

## Architecture

### Current Recommendation Architecture

Phase 5D added backend recommendation routes at `/api/recommendations` and bundle routes at `/api/bundles`. Product recommendations are computed in `backend/src/lib/commerceIntelligence.ts` using:

- paid online orders or delivered COD orders for co-purchase signals
- active admin bundles
- same-category fallback
- safe catalog fallback
- product availability, archive, stock, and price filters

Frontend integration exists in `ProductDetailPage`, `CartPage`, `CartDrawer`, `BundleShelf`, and API helpers. Recommendation items carry `type`, `label`, and `reason`, but not a shared source enum contract such as `CO_PURCHASE` or `CURATED`.

### Current Merchandising Architecture

Merchandising is split across products, categories, collections, hero slides, and Phase 5D bundles. Collections are admin-managed and product assignment is stored in `collection_products`. Bundles are admin-managed in `bundles` and `bundle_products`. Public collection reads filter archived products but do not fully enforce purchasable price/stock validity.

### Current Analytics Architecture

Backend admin analytics is order/revenue oriented in `backend/src/routes/analytics.ts`. Frontend has Meta Pixel helper methods in `frontend/src/lib/metaPixel.ts`, but no first-party event ingestion for product views, search, recommendation impressions, recommendation clicks, add-to-cart rate, checkout validation failures, or recommendation CTR.

### Current Personalization Capability

Personalization is lightweight and client-side. Recently viewed products are tracked by product slug in local storage from `ProductDetailPage`, capped, de-duped, and filtered against current product store data before display. Wishlist is user-scoped through Zustand persistence and syncs with backend for authenticated users. There is no backend-personalized recommendation endpoint using authenticated purchase/wishlist/recent behavior.

### Current Search Architecture

Search is client-side. `Navbar` and `SearchPage` use `useProductStore.searchProducts` against the loaded product catalog. Search suggestions are local product/category matches. Trending search chips are hard-coded strings. There is no backend search endpoint, search analytics, or real popular-search signal.

### Current Cart Recommendation Architecture

`CartPage` and `CartDrawer` request backend cart recommendations and fall back to client-selected catalog items if empty or failed. Copy is mostly source-aware after Phase 5D. Checkout does not depend on recommendation APIs, and cart validation remains backend authoritative.

### Current Homepage Data Flow

`HomeExperience` uses product store data, categories, hero slides, collections, and bundles. The catalog is globally loaded in `App.tsx` and periodically refreshed. Homepage merchandising is mostly curated/catalog-driven, not personalized, and sections depend on loaded product arrays.

## Findings

### 1. First-party conversion analytics are missing

Problem: BrajMart cannot measure product views, search, recommendation CTR, add-to-cart rate, checkout validation failures, or funnel abandonment from its own backend data.

Why it matters: Phase 5E needs measurable conversion and trust improvements. Meta Pixel alone cannot power admin analytics, backend recommendations, or privacy-controlled internal reports.

Current implementation: `frontend/src/lib/metaPixel.ts` tracks a small set of third-party events. `backend/src/routes/analytics.ts` reports orders and revenue from database state.

Recommended solution: Add a lightweight typed analytics event API and additive event table. Store low-PII event names, product IDs, recommendation source, cart/session correlation, user ID when authenticated, and timestamps. Analytics failures must be non-blocking.

Files affected: `backend/src/routes/analytics.ts`, `backend/src/server.ts`, `frontend/src/lib/api.ts`, new analytics utility, admin analytics page.

Backend impact: New validated write route and aggregate queries.

Database impact: Additive `commerce_events`-style table with indexes by event, product, user/session, and created date.

Risk: Medium.

Priority: P1.

### 2. Search and navigation use unsupported "trending" and "popular" labels

Problem: Search UI has hard-coded "Trending Searches", and `SearchPage` renders "Popular Products" from client-side catalog sorting rather than real popularity data.

Why it matters: The project explicitly forbids fake popularity and unsupported behavior claims.

Current implementation: `Navbar.tsx` hard-codes trending terms. `SearchPage.tsx` sorts products with `compareProductsByQuality` and labels them "Popular Products".

Recommended solution: Rename unsupported labels to neutral merchandising copy such as "Quick Searches" and "Featured Products", or back them with real event/order analytics after analytics exists.

Files affected: `frontend/src/components/layout/Navbar.tsx`, `frontend/src/pages/SearchPage.tsx`, possibly admin analytics if real signals are added.

Backend impact: None for neutral copy; analytics endpoint if real popularity is implemented.

Database impact: None for neutral copy; additive events table for real popular searches.

Risk: Low.

Priority: P0.

### 3. Product admin still exposes manual rating, review-count, and sold-count fields

Problem: Admin product forms allow manual rating, review count, and sold count editing even though Phase 5C introduced approved-review aggregates.

Why it matters: Public trust data must come from approved reviews. Manual fields invite accidental or intentional mismatch with moderated review data.

Current implementation: `AdminProducts.tsx` renders rating/review count fields, and `backend/src/routes/products.ts` still accepts `rating`, `reviewCount`, and `soldCount` on create/update. Public mapping overrides rating/review count with approved review aggregates when present, but legacy columns remain editable and sold count still exists.

Recommended solution: Remove or lock manual storefront rating/review-count editing in admin UI. Keep legacy DB columns only for compatibility. Do not use `sold_count` for public claims unless it is tied to real order data.

Files affected: `frontend/src/pages/admin/AdminProducts.tsx`, `backend/src/routes/products.ts`.

Backend impact: Validation should ignore or restrict manual trust fields for normal admin mutations.

Database impact: No destructive change recommended.

Risk: Medium.

Priority: P1.

### 4. Public collection products are not fully filtered for commerce validity

Problem: Collection product reads filter archived products but do not fully exclude invalid price or unavailable stock.

Why it matters: Storefront merchandising should not surface invalid purchasable items. Checkout validation remains authoritative, but discovery should be clean.

Current implementation: `backend/src/routes/collections.ts` uses `p.archived_at IS NULL` in public collection product queries.

Recommended solution: Reuse the same valid product predicate used by recommendations/products: non-archived, price > 0, in stock, and valid inventory state.

Files affected: `backend/src/routes/collections.ts`.

Backend impact: Safer public collection payloads.

Database impact: None.

Risk: Low.

Priority: P1.

### 5. Admin collection product assignment accepts invalid product IDs/states too loosely

Problem: Admin collection assignment deletes and reinserts IDs without validating that products are active, non-archived, valid-price products.

Why it matters: It can create stale or invalid merchandising relationships and relies on public filters to hide bad assignments later.

Current implementation: `PUT /api/collections/:id/products` uses `INSERT IGNORE` after basic array handling.

Recommended solution: Validate product IDs server-side, reject archived/invalid products, reject duplicates with a clear 400, and audit meaningful changes.

Files affected: `backend/src/routes/collections.ts`.

Backend impact: Stronger admin validation.

Database impact: None.

Risk: Medium.

Priority: P1.

### 6. Recommendation source contract is not normalized across backend and frontend

Problem: Recommendation items have lowercase `type` values such as `frequently_bought_together`, `curated_bundle`, `related_products`, and `popular_fallback`, but no shared explicit source enum contract.

Why it matters: Phase 5E requires the frontend to know why a recommendation exists and to avoid claims like "Frequently bought together" without evidence.

Current implementation: Frontend checks source strings in `CartPage` and `CartDrawer`; backend emits type/label/reason.

Recommended solution: Add a stable `sourceType` field while preserving current `type` for backward compatibility. Map co-purchase to `CO_PURCHASE`, bundles to `CURATED`, category matches to `SAME_CATEGORY`, and catalog fallback to `FALLBACK`.

Files affected: `backend/src/lib/commerceIntelligence.ts`, `frontend/src/lib/api.ts`, cart/product recommendation UI.

Backend impact: Response-shape addition only.

Database impact: None.

Risk: Low.

Priority: P1.

### 7. Bundle UX assumes a five-product display in places

Problem: `BundleShelf` displays only the first five bundle products, and checkout bundle snapshot display requires exactly five products.

Why it matters: Admin bundles are variable product sets. Showing only five products can make "Add Set" ambiguous if more products exist, while checkout may omit the snapshot for smaller or larger valid bundles.

Current implementation: `BundleShelf.tsx` slices `bundle.products.slice(0, 5)`. `CheckoutPage.tsx` accepts the session snapshot only if `products.length === 5`.

Recommended solution: Support variable bundle sizes in snapshot display and make the CTA copy clear about displayed items. Backend/cart validation must remain authoritative.

Files affected: `frontend/src/components/recommendations/BundleShelf.tsx`, `frontend/src/pages/CheckoutPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

### 8. Cart trust copy is not fully settings-aware

Problem: Cart summary copy says "Razorpay online checkout and COD support" even when COD may be disabled by settings.

Why it matters: Trust copy must not imply unavailable payment options.

Current implementation: `CartPage.tsx` renders static copy in the protected payment block.

Recommended solution: Use public settings to show COD messaging only when COD is enabled. Keep Razorpay/payment logic untouched.

Files affected: `frontend/src/pages/CartPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 9. Wishlist can render stale local product snapshots

Problem: Wishlist items are persisted locally and can remain visible if a product is later archived, invalid, or unavailable unless backend sync/product store reconciliation removes them.

Why it matters: Archived products must not appear in customer discovery surfaces.

Current implementation: `wishlistStore.ts` de-dupes entries and syncs authenticated wishlist snapshots, while `WishlistPage.tsx` renders persisted products directly through `ProductCard`.

Recommended solution: Reconcile wishlist entries against authoritative product data before display, or add a batched wishlist hydration endpoint that filters archived/invalid products.

Files affected: `frontend/src/store/wishlistStore.ts`, `frontend/src/pages/WishlistPage.tsx`, possibly `backend/src/routes/users.ts`.

Backend impact: Optional batch validation endpoint.

Database impact: None.

Risk: Medium.

Priority: P1.

### 10. Recently viewed is capped and de-duped but remains local-only

Problem: Recently viewed behavior is anonymous-safe and bounded, but authenticated users do not get cross-device continuity, and stale entries are only filtered after catalog load.

Why it matters: It limits personalization quality and can momentarily reduce trust if old local data appears during loading.

Current implementation: `ProductDetailPage.tsx` stores recent slugs in browser storage, caps the list, de-dupes entries, and filters against current products for display.

Recommended solution: Keep anonymous local storage, add optional authenticated sync only if a low-PII behavior table is added. Do not block rendering on recent-view APIs.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`, future analytics/personalization routes.

Backend impact: Optional event ingestion.

Database impact: Optional analytics table.

Risk: Low.

Priority: P2.

### 11. Product detail recommendation placement competes with reviews

Problem: Product detail recommendations appear before reviews, while Phase 5E hierarchy puts approved reviews before related/recommended products.

Why it matters: Trust proof should be visible before additional shopping suggestions, especially on product detail pages.

Current implementation: `ProductDetailPage.tsx` renders recommendation carousels and recently viewed near the end, with reviews also near the end.

Recommended solution: Preserve page functionality but move recommendation blocks after reviews or keep only the most relevant co-purchase/bundle block before deep content.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

### 12. Product carousel controls are not equally discoverable on mobile and keyboard

Problem: Carousel arrows are hidden until hover on desktop and hidden entirely on small screens.

Why it matters: Touch users can swipe, but keyboard and assistive users benefit from visible controls and clearer region labels.

Current implementation: `ProductCarousel.tsx` uses Embla with autoplay and hidden `sm:flex` hover-visible arrows.

Recommended solution: Add semantic carousel labels, visible focus behavior, reduced-motion-aware autoplay, and small-screen controls when needed.

Files affected: `frontend/src/components/product/ProductCarousel.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

### 13. Cart drawer lacks a full focus trap

Problem: The cart drawer focuses the close button and supports Escape, but tab focus is not trapped inside the dialog.

Why it matters: Modal drawers need predictable keyboard behavior.

Current implementation: `CartDrawer.tsx` uses a custom fixed overlay with `role="dialog"` and `aria-modal="true"`.

Recommended solution: Use existing Radix Sheet/Dialog infrastructure or add a focused, tested trap without changing cart validation or checkout flow.

Files affected: `frontend/src/components/cart/CartDrawer.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 14. Mobile filter drawer has dialog semantics but no Escape/focus lifecycle

Problem: Product filters mobile overlay has `role="dialog"` and close button, but no explicit Escape handling or focus restore.

Why it matters: Search/discovery filters are a key mobile workflow and should be predictable with keyboard/screen readers.

Current implementation: `ProductsPage.tsx` implements a custom fixed overlay for mobile filters.

Recommended solution: Move to Radix Sheet or add focus management and Escape handling.

Files affected: `frontend/src/pages/ProductsPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

### 15. Checkout payment method selection uses custom radio cards

Problem: Payment method options are custom `div role="radio"` controls.

Why it matters: The implementation has keyboard handlers, but native radio inputs reduce accessibility risk in a high-stakes payment step.

Current implementation: `CheckoutPage.tsx` renders custom radio-card controls around hidden input semantics.

Recommended solution: Preserve payment logic and convert the UI wrapper to labels/native radios or Radix RadioGroup with tested keyboard behavior.

Files affected: `frontend/src/pages/CheckoutPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Medium because checkout UI is sensitive.

Priority: P2.

### 16. Public recommendation endpoints are not rate-limited

Problem: Recommendation routes are public and can run database-backed recommendation work without route-specific rate limiting.

Why it matters: Co-purchase/cart recommendation computation is bounded and cached, but public endpoints should still resist abuse.

Current implementation: `recommendations.ts` has validation and limits; `rateLimit.ts` exists but is not applied to recommendation routes.

Recommended solution: Apply a modest IP-based rate limit to recommendation read endpoints.

Files affected: `backend/src/routes/recommendations.ts`.

Backend impact: Minor middleware addition.

Database impact: None.

Risk: Low.

Priority: P2.

### 17. Homepage personalization is minimal

Problem: Homepage does not yet show a bounded "Continue Shopping" or personalized section from real recent/wishlist signals.

Why it matters: Phase 5E personalization can improve discovery without fake claims.

Current implementation: Homepage uses catalog, categories, collections, hero slides, and bundles; recent views are only surfaced on product detail.

Recommended solution: Add sections only when valid data exists: recently viewed for anonymous users, wishlist/recent interest for authenticated users, and curated/catalog fallback with neutral copy.

Files affected: `frontend/src/components/HomeExperience.tsx`, recent-view helper extraction.

Backend impact: None initially.

Database impact: None initially.

Risk: Low.

Priority: P2.

### 18. Storefront search is fully client-side

Problem: Products/category/search pages depend on loading the full product catalog into the client store.

Why it matters: This is acceptable for a small catalog but will become slow and memory-heavy as the catalog grows. It also prevents server-backed ranking and search analytics.

Current implementation: `productStore.ts`, `SearchPage.tsx`, `ProductsPage.tsx`, and `CategoryPage.tsx` filter locally.

Recommended solution: Keep current behavior short-term, but add backend search with pagination, filters, availability, and sanitized fields before the catalog grows materially.

Files affected: `backend/src/routes/products.ts`, `frontend/src/lib/api.ts`, search/products/category pages.

Backend impact: New read endpoint or query support.

Database impact: Indexes on category, price, archived status, stock state, and searchable names/tags may be needed.

Risk: Medium.

Priority: P2.

### 19. Sitemap includes product tag URLs that may imply unsupported popularity

Problem: Server sitemap includes `/products?tag=bestseller` and a redirect map includes `best-selling-products`.

Why it matters: SEO surfaces should not imply fake best-selling status unless tags are true merchandising labels or real sales-backed lists.

Current implementation: `backend/src/server.ts` includes static SEO routes for product tags.

Recommended solution: Keep URLs if historically required, but ensure page copy maps "bestseller" to neutral "Featured Products" unless real sales ranking exists.

Files affected: `backend/src/server.ts`, `frontend/src/pages/ProductsPage.tsx`.

Backend impact: Optional sitemap pruning later.

Database impact: None.

Risk: Low.

Priority: P2.

### 20. Prerender/build falls back when production API routes return 404

Problem: Frontend build completed during prior validation, but SEO/prerender logs showed production API 404 fallbacks for sitemap/product/category data.

Why it matters: SEO output may be stale or incomplete if deployment API base paths differ from build expectations.

Current implementation: Frontend build reuses local sitemap artifacts when production API calls fail.

Recommended solution: Verify Vercel/Render API base configuration and prerender inputs before relying on production sitemap freshness.

Files affected: frontend build/prerender scripts and environment configuration.

Backend impact: None unless API base route mismatch exists.

Database impact: None.

Risk: Medium.

Priority: P1.

### 21. Free-shipping progress exists but should remain settings-gated everywhere

Problem: Free-shipping progress is available, but any future placement must be guarded by shipping settings.

Why it matters: Shipping promises must be backend/settings backed.

Current implementation: `FreeShippingProgress.tsx`, `CartPage.tsx`, and checkout summary use settings/validation paths for money display.

Recommended solution: Continue using settings-backed thresholds only; never hard-code "free shipping" globally.

Files affected: Cart and checkout UI if expanded.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P3.

### 22. Global mobile typography overrides can distort compact commerce controls

Problem: `index.css` applies global mobile font sizing to `body, p, span, li`, which can affect product cards, metadata, badges, and compact controls.

Why it matters: It can cause text wrapping, layout shift, or clipped CTAs at 320px widths.

Current implementation: Mobile CSS forces broad font-size and line-height adjustments.

Recommended solution: Replace broad selectors with component-scoped responsive typography where overflow is observed.

Files affected: `frontend/src/index.css`, product/cart/search components.

Backend impact: None.

Database impact: None.

Risk: Medium visual regression risk.

Priority: P2.

## Data Integrity Summary

PASS: Public product cards do not show ratings when approved review count is zero. Product structured data uses approved review aggregates. Recommendation backends filter archived, invalid-price, and invalid-stock products. Checkout/cart validation remains backend authoritative.

PARTIAL: Collections and wishlist surfaces can still expose stale or invalid product snapshots. Manual trust metric fields remain in admin product forms.

BLOCKED: Real search popularity, recommendation CTR, and personalized homepage ranking require a first-party event system that does not yet exist.

## Performance Summary

PASS: Recommendation endpoints are limited and cached. Product detail/cart recommendations are secondary and do not block checkout.

PARTIAL: Search/products/category pages rely on full catalog client filtering. Product store and settings refresh on window focus and intervals, which is acceptable now but can duplicate network work.

## Accessibility Summary

PASS: Many buttons/links have aria labels and visible focus utilities exist. Cart drawer supports Escape and initial focus.

PARTIAL: Custom drawer/filter overlays lack complete focus trapping. Product carousel controls are not consistently visible/discoverable. Checkout payment method controls should be native or Radix-backed.

## Security Summary

PASS: Admin analytics and bundle routes use `auth` plus `adminOnly`. Recommendation endpoints validate IDs and limits. Review moderation and verified-purchase constraints are preserved.

PARTIAL: Public recommendation endpoints should use rate limiting. Admin collection product assignment needs stricter server-side product-state validation.

## Recommended Phase 5E Order

1. Phase 5E.1: Normalize recommendation source contract, rate-limit recommendations, and remove unsupported storefront popularity/trending claims.
2. Phase 5E.2: Product detail conversion polish with reviews before non-essential recommendations.
3. Phase 5E.3: Cart/cart drawer trust copy and accessibility polish.
4. Phase 5E.4: Homepage recently viewed/continue shopping, rendered only with valid data.
5. Phase 5E.5: Search neutral copy, empty-state recovery, and later backend search.
6. Phase 5E.6: First-party low-PII analytics event system.
7. Phase 5E.7: Admin analytics/merchandising controls based on observed data only.
8. Phase 5E.8: Mobile/accessibility/performance QA at 320px, 375px, 390px, and 414px.
