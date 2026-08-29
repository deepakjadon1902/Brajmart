# BrajMart Phase 5D Recommendation Model

## Principles

- Backend is authoritative for recommendation eligibility.
- Recommendations are deterministic and explainable.
- No fake urgency, fake sales, fake reviews, random ranking, or frontend-only commerce claims.
- Checkout, cart validation, inventory reservation, payment verification, and COD settings remain unchanged.

## Product eligibility

A product can appear in purchase recommendations only when:

- `archived_at IS NULL`
- `price > 0`
- `in_stock = 1`
- `stock_quantity IS NULL` or `stock_quantity - reserved_quantity > 0`
- `reserved_quantity <= stock_quantity` when physical stock is known
- it is not the anchor product and not already in the active cart context

Unavailable products are excluded from purchase recommendations.

## Signals

1. Real co-occurrence: paid or delivered merchant orders containing anchor product and another valid product.
2. Curated bundle membership: active admin bundle containing the anchor product.
3. Category similarity: same category/subcategory valid products.
4. Review quality: approved review aggregate from Phase 5C.
5. Popularity fallback: valid products ordered by `sold_count` only when no stronger purchase/bundle/category signal exists.

## Co-occurrence calculation

- Read recent valid merchant orders from `orders.items`.
- Exclude cancelled orders, failed payments, and products that are archived, invalid-priced, or unavailable.
- Count pair frequency for `anchor -> recommended`.
- Calculate confidence as `pairCount / anchorOrderCount`.
- Rank by co-occurrence count, confidence, review quality, and deterministic product id tie-breaker.
- Do not count anonymous cart/wishlist activity as "frequently bought".

## Curated bundles

- Admin bundles are stored in `bundles` and `bundle_products`.
- Bundle price is the backend sum of included product prices.
- Savings are not shown unless a backend-supported discount is introduced later.
- Bundle products must remain valid and available. Invalid bundle products are filtered from public bundle output; admin preview can show validation state.

## Fallbacks

- Product detail: if co-purchase data is empty, show related products with a neutral label.
- Cart: if no real co-purchase exists, show "Complete your order" rather than "Often paired".
- Homepage: show active curated bundles only; if none exist, hide the bundle section.
- API failure must not block product detail, cart, drawer, or checkout.

## Cache strategy

- Public recommendation reads may use short `Cache-Control` headers and small in-memory caches.
- Cache keys include recommendation type and product/cart ids.
- Admin mutations clear bundle-related in-memory caches.
- Checkout never depends on recommendation API availability.

## Edge cases

- Self-recommendations are removed.
- Duplicate recommendations are removed.
- Archived products are removed.
- Invalid price products are removed.
- Invalid inventory products are removed.
- Empty results return an empty list, not fake recommendations.
- Bundle add-to-cart adds individual products; existing cart validation remains authoritative.
