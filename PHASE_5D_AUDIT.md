# BrajMart Phase 5D Audit

Status: implementation checkpoint before commerce-intelligence coding.

## What was inspected

- Frontend: `ProductCard`, `ProductDetailPage`, `ProductsPage`, `SearchPage`, `Home`, `HomeExperience`, `CartPage`, `CartDrawer`, wishlist/cart/product stores, API helpers, admin routing/layout.
- Backend: `products`, `orders`, `cart`, `collections`, `reviews`, `inventory`, `orderPricing`, `settings`, `users`, `analytics`, Razorpay/COD routes, auth/admin middleware, audit logging.
- Database shape from migrations/schema: `products`, `categories`, `collections`, `collection_products`, `orders`, `payments`, `payment_status`, `carts`, `wishlists`, `reviews`, `inventory_transactions`, `settings`, `admin_audit_logs`.

## Current recommendation and bundle logic

- Product detail related products are computed in the browser from loaded catalog products, using same category first and then fallback products.
- Cart page recommendations are computed in the browser from cart categories plus `soldCount`.
- Cart drawer recommends the single highest-quality purchasable catalog product not already in cart.
- Homepage bundle is generated in the browser with five products from one category and rotates every two days using `Date.now()`.
- No backend recommendation API exists yet.
- No admin-managed bundle system exists yet.
- Reviews are now real approved aggregates from Phase 5C.
- Wishlist and cart data exists as per-user JSON rows.
- Order items are stored in `orders.items` JSON; valid online orders are determined by paid `payments` or `payment_status`, and COD remains governed by business settings.

## Issues

| Problem | Why it matters | Current implementation | Recommended solution | Files affected | Backend impact | Database impact | Performance impact | Security impact | Risk | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Frontend-only related products | Recommendations are not authoritative and can include weak or stale relevance | `ProductDetailPage` uses client category fallback | Add backend `/api/recommendations/product/:productId` with server filtering and deterministic sources | `ProductDetailPage`, new backend route/service | New read-only route | None required for derived results | Cache and limit query work | Prevent hidden/invalid product leakage | Medium | P0 |
| Artificial rotating homepage combo | Looks fake and violates no arbitrary popularity/Date logic | `HomeExperience` uses `Date.now()` bucket and `soldCount` heuristics | Replace with backend curated bundle/recommendation source; remove fake rotation language | `HomeExperience`, `Home` | Bundle/recommendation API | Add bundle tables if needed | Small extra API request | Admin-only mutation required | Medium | P0 |
| No admin bundle control | Business cannot manage complete sets safely | No `/admin/bundles` | Add admin bundle CRUD with validation and audit logging | Admin routes/pages/API | Admin CRUD endpoints | Additive `bundles`, `bundle_products` | Indexed lookups | Requires `auth + adminOnly` | Medium | P0 |
| Co-purchase signal absent | "Frequently bought" claims cannot be defended | No co-occurrence calculation | Derive from paid/delivered merchant orders and exclude cancelled/failed/test where identifiable | New recommendation service | Read `orders.items`, payment visibility SQL | No materialized table initially | Limit recent order scan and cache | No PII returned | Medium | P0 |
| Cart upsell uses generic quality sort | It may feel pushy or irrelevant | `CartPage`, `CartDrawer` use client product list | Use backend cart recommendations from current cart product IDs; fallback label must not claim purchase behavior | Cart UI, API helper | New POST endpoint | None | Non-blocking query | Server filters product safety | Low | P1 |
| Recently viewed is local-only | It may keep references to removed products until catalog refresh | localStorage slugs filtered against current product store | Keep local storage but display only products returned by public catalog or backend recs | `ProductDetailPage` | Optional future sync | None | Minimal | No private data risk | Low | P2 |
| Wishlist is JSON interest data | Personalization must not expose other users or cause N+1 | `wishlists.items` JSON per user | Use only authenticated user's wishlist in future batched personalization endpoints | Wishlist store/API, future route | Optional read-only personalized endpoint | None | Avoid per-card queries | Prevent IDOR | Medium | P2 |
| No bundle checkout authority | Add-set uses individual cart items only, snapshot is UI-only | `sessionStorage` bundle snapshot in checkout | Keep checkout authoritative through existing cart validation; bundle CTA only adds validated products | Checkout/cart/bundle UI | No payment change | None | No checkout dependency | Avoid price trust on frontend | Low | P0 |
| Product popularity can be legacy/manual | "Trending" or "best selling" can be misleading if based only on tags | Store filters tags/soldCount | Use precise labels; only use real paid/delivered order count for purchase claims | Home/category UI | Analytics/recs reads orders | None | Cached | No security issue | Low | P1 |
| Admin audit logging exists but bundles not included | New admin mutations need traceability | `admin_audit_logs` covers existing admin actions | Log `BUNDLE_CREATE`, `BUNDLE_UPDATE`, `BUNDLE_ACTIVATE`, `BUNDLE_DEACTIVATE` | New routes | Reuse Phase 5B logging | None beyond existing table | Minimal | Redacts sensitive keys | Low | P0 |
| Product safety filtering duplicated | Frontend may drift from backend safety rules | Product utilities and API list filter archived only | Centralize recommendation product eligibility on backend: non-archived, active stock, price > 0, valid inventory | New service | Read-only safety filter | None | Better API correctness | Avoid invalid product purchase prompts | Low | P0 |

## Conflicts and safe choices

- The prompt asks for real purchase relationships; the current schema stores order items as JSON rather than a normalized `order_items` table. Safe choice: derive co-occurrence from recent valid order JSON with limits/cache now; defer materialization unless scale demands it.
- The prompt allows discounts but says backend must calculate them. Existing checkout has no bundle discount authority. Safe choice: implement bundles without discounts/savings initially; show backend-computed total only.
- COD remains disabled by business configuration. Phase 5D will not enable or test COD behavior.
- Razorpay live credentials exist. Phase 5D will not execute or modify payment logic.

## Implementation plan

1. 5D.1: Add docs and recommendation model.
2. 5D.2: Add additive bundle schema helper/migration, backend bundle route, recommendation service, and public recommendation routes.
3. 5D.3: Add admin bundle page and API helpers.
4. 5D.4: Replace product detail/cart/cart drawer/home bundle heuristics with backend-driven non-blocking recommendations and bundles.
5. 5D.5: Add smoke tests for admin authorization, bundles, co-occurrence filtering, invalid/archived exclusion, audit logging, and cleanup.
6. 5D.6: Run backend/frontend builds, focused lint, existing inventory/review/checkout regressions where available.
