# BrajMart Phase 5D Audit

Status: implementation audit after repository inspection on 2026-08-29.

## What Was Inspected

- Frontend: `ProductCard`, `ProductDetailPage`, `ProductsPage`, `CategoryPage`, `SearchPage`, `HomeExperience`, `CartPage`, `CartDrawer`, recently viewed local storage, wishlist/cart/product stores, API helpers, React Query shell, mobile navigation, recommendation components, and admin bundle UI.
- Backend: `products`, `orders`, `cart`, `collections`, `reviews`, `inventory`, `orderPricing`, `settings`, `users`, `analytics`, `recommendations`, `bundles`, `commerceIntelligence`, order visibility, audit logging, and API registration.
- Database shape: `products`, `categories`, `subcategories`, `collections`, `collection_products`, `orders`, `payments`, `payment_status`, `users`, `wishlists`, `carts`, `reviews`, `inventory_transactions`, `settings`, `admin_audit_logs`, `bundles`, and `bundle_products`.

## Existing Commerce Intelligence

1. Existing recommendation logic: `backend/src/lib/commerceIntelligence.ts` provides product and cart recommendation APIs backed by valid products, recent order co-occurrence, active bundles, category similarity, review aggregates, and safe fallback.
2. Existing bundle logic: `bundles` and `bundle_products` are additive tables with public and admin APIs. Bundles are priced as backend-calculated sums; no bundle discounts are applied.
3. Existing popularity logic: public catalog still exposes `soldCount`, but Phase 5D UI no longer displays "sold this week" from that legacy/manual field.
4. Existing order analytics: admin analytics derives revenue from paid payment records plus COD order totals using existing order visibility helpers.
5. Existing customer behavior data: carts and wishlists store per-user JSON item snapshots; no server-side recently-viewed sync exists.
6. Existing wishlist information: authenticated users have one wishlist row in `wishlists`; public recommendation APIs do not expose another user's data.
7. Existing cart information: authenticated carts persist JSON rows; checkout/cart validation reprices from products server-side.
8. Existing recently viewed behavior: product detail stores recent product slugs in localStorage, de-duped and capped.
9. Existing category relationships: products have legacy category text plus `category_id`/`subcategory_id`; collections provide purpose-based merchandising.
10. Existing product metadata: price, MRP, image gallery, category, subcategory, tags, stock, reserved stock, variants, SEO fields, and approved review aggregates are mapped.
11. Existing review data: Phase 5C stores verified reviews with moderation; product cards use approved aggregate rating only.
12. Existing admin capabilities: product, category, order, inventory, review, audit log, analytics, settings, and bundle screens exist.

## Issues And Recommendations

| Problem | Why it matters | Current implementation | Recommended solution | Files affected | Backend impact | Database impact | Performance impact | Security impact | Risk | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Co-occurrence accepted non-delivered COD orders | COD can be cancelled before payment collection, so recommendations could over-count weak signals | Recommendation service used global merchant order visibility | Count paid online orders at valid statuses; count COD only once delivered | `backend/src/lib/commerceIntelligence.ts` | Read-only SQL tightened | None | Same 600-order cap | More trustworthy signals | Low | P0 |
| Product card showed `sold this week` from `soldCount` | This could imply recent sales without recent order evidence | `ProductCard` displayed legacy/manual sold count | Remove frontend sales claim until backed by real recent order data | `frontend/src/components/product/ProductCard.tsx` | None | None | None | Removes misleading commerce claim | Low | P0 |
| Frontend purchasability missed invalid price/inventory edge cases | Fallback recommendations and admin selection could include invalid products before server rejection | `isProductPurchasable` focused on stock availability | Include price > 0 and reserved <= stock sanity checks | `frontend/src/utils/productPresentation.ts` | None | None | Less bad fallback work | Reduces invalid add prompts | Low | P0 |
| Cart drawer label always said "Pair it with" | Fallback products should not imply real pairing | Drawer displayed one label for server and local fallback recs | Use "Often paired" only for co-purchase; otherwise neutral "Complete your order" | `frontend/src/components/cart/CartDrawer.tsx` | None | None | None | Improves trust | Low | P0 |
| Admin bundles are functional but minimal | Prompt asks for product reorder, dates, image, preview, search/filter | UI supports create/edit/status/product selection/search | Future polish: drag/reorder controls, date fields, image upload, validation badges | `frontend/src/pages/admin/AdminBundles.tsx` | Existing APIs already support sort/date/image payloads | Existing columns present | Minimal | Existing `auth + adminOnly` remains | Medium | P1 |
| No personalized recommendation endpoint | Repeat-purchase personalization is limited to local/session behavior | Product/cart recommendations are contextual only | Add authenticated batched endpoint later using delivered purchases, wishlist, and recent views if privacy policy allows | New route/service | New read-only route | None initially | Needs caching | Must avoid IDOR/PII | Medium | P2 |
| Co-occurrence derives from order JSON | Parsing JSON in app code is fine at current scale but not ideal for large order volume | Recent 600 orders are scanned and cached for 60 seconds | Materialize pair counts or normalize order items if volume grows | `commerceIntelligence`, migration | Optional future job/table | Additive table only | Improves scale | No PII | Medium | P2 |
| Cart fallback uses quality sorting | Fallback is safe but not deeply personalized | Uses valid catalog fallback after server recommendations | Keep neutral copy; add stronger signals only when backed by data | Cart UI/service | Existing | None | Existing limits | Low | Low | P2 |
| Recently viewed is local-only | It can disappear across devices and does not sync for authenticated users | localStorage slug list filtered through current catalog | Optional authenticated sync with strict ownership and capped history | Product detail/new route | Optional | Additive table optional | Batched reads | PII-safe by design | Medium | P3 |
| Bundle discounts are not supported | AOV bundles cannot show savings beyond MRP product savings | Backend sums product prices and reports savings `0` | Keep no-discount model until pricing architecture supports backend-authoritative bundle discounts | Bundle service/checkout future | No payment changes now | Optional later | None now | Prevents price tampering | Low | P1 |

## Safe Architecture Confirmed

- Recommendation APIs are non-blocking for product detail, cart page, and drawer.
- Checkout does not depend on recommendation APIs.
- Public recommendations filter archived products, invalid prices, out-of-stock products, and invalid reserved inventory states.
- Admin bundle mutations require `auth + adminOnly` and reuse Phase 5B audit logging.
- Bundle "add set" adds individual products; existing cart validation and checkout pricing remain authoritative.
- Razorpay verification, webhook logic, COD configuration, payment amount authority, and inventory lifecycle were not modified.
- Sitemap only lists active products/categories/blogs; recommendation APIs do not create indexable URLs.

## Database Findings

- `orders.items` is JSON, not normalized order-item rows.
- Online order validity is represented by paid rows in `payments` or `payment_status`.
- COD order validity is business-state based; for recommendations Phase 5D now counts COD only when delivered.
- `bundles` and `bundle_products` are additive, indexed, and use foreign keys.
- `admin_audit_logs` already exists from Phase 5B and is reused.

## Remaining Recommendation

Phase 5D is mostly implemented as a pragmatic backend-driven recommendation layer. The next highest-value work is admin bundle UX polish and optional materialized co-occurrence once order volume justifies it.
