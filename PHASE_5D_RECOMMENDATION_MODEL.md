# BrajMart Phase 5D Recommendation Model

Status: implemented deterministic model, audited 2026-08-29.

## Principles

- Backend is authoritative for recommendation eligibility.
- Recommendations are deterministic, explainable, and cacheable.
- No fake urgency, fake sales, fake reviews, random ranking, or frontend-only commerce claims.
- Checkout, cart validation, inventory reservation, payment verification, Razorpay webhooks, and COD settings remain unchanged.

## Product Eligibility

A product can appear in purchase recommendations only when:

- `archived_at IS NULL`
- `price > 0`
- `in_stock = 1`
- `stock_quantity IS NULL`, or available stock is positive
- `reserved_quantity >= 0`
- `reserved_quantity <= stock_quantity` when stock is managed
- it is not the anchor product and not already in the active cart context

Unavailable products are excluded from purchasable recommendation surfaces.

## Signals

1. Real co-occurrence: valid paid online orders, plus delivered COD orders, containing both anchor product and candidate product.
2. Curated bundle membership: active admin bundle containing the anchor product.
3. Category similarity: same category products that pass purchase eligibility.
4. Review quality: approved review aggregate from Phase 5C.
5. Safe fallback: valid products ordered by legacy `sold_count`, approved review signal, creation date, and product id only when stronger signals are insufficient. UI copy for this fallback is neutral.

## Co-Occurrence Calculation

- Read recent valid merchant orders from `orders.items`.
- Exclude cancelled orders, failed payments, invalid payment states, archived products, invalid-price products, and unavailable products.
- Count paid online orders in valid fulfillment statuses.
- Count COD orders only after delivery.
- Count pair frequency for `anchor -> recommended`.
- Calculate confidence as `pairCount / anchorOrderCount`.
- Rank by pair count, confidence, review quality, and deterministic id tie-breaker.
- Do not count carts, wishlists, or local recent views as "frequently bought".

## Curated Bundles

- Admin bundles are stored in `bundles` and `bundle_products`.
- Bundle price is the backend sum of currently valid included product prices.
- Savings are `0` unless a future backend-supported discount model is added.
- Public bundle output filters invalid or unavailable products.
- Admin mutations are audited as `BUNDLE_CREATE`, `BUNDLE_UPDATE`, `BUNDLE_ACTIVATE`, and `BUNDLE_DEACTIVATE`.

## Fallbacks

- Product detail: if backend sections are empty or unavailable, show neutral local related products.
- Cart page: show "Often Paired With Your Items" only when real co-purchase data exists; otherwise show "Complete Your Order".
- Cart drawer: show "Often paired" only for real co-purchase; otherwise show "Complete your order".
- Homepage: show active curated bundles only; if none exist, hide the shelf.
- API failure never blocks product detail, cart, drawer, or checkout.

## Cache Strategy

- Recommendation service uses a 60-second in-memory cache.
- Public routes send short cache headers with stale-while-revalidate.
- Cart recommendation route sends private cache headers.
- Admin bundle mutations clear commerce intelligence cache.
- Product and category lists keep their existing short cache behavior.

## Edge Cases

- Self-recommendations are removed.
- Duplicate recommendations are removed.
- Archived products are removed.
- Invalid price products are removed.
- Invalid reserved inventory states are removed.
- Empty results return empty arrays, not generated filler.
- Bundle add-to-cart adds individual product lines; checkout validation remains authoritative.

## Known Limits

- Order items remain JSON-backed. This is acceptable at the current capped scan size but should become materialized or normalized if order volume grows.
- Personalized recommendations are lightweight and contextual, not a full account-based recommendation graph.
- Bundle discounts are intentionally not implemented because checkout pricing has no backend-authoritative bundle discount contract yet.
