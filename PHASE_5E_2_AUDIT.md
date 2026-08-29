# BrajMart Phase 5E.2 Product Detail Audit

Audit date: 2026-08-29

Scope: `ProductDetailPage`, product cards, review components, product data types, cart/wishlist stores, API contracts, recommendation source metadata, inventory-derived availability, settings-derived delivery/shipping copy, image utilities, SEO schema, and responsive CSS.

## Product Detail Strengths

- Product data is backend-driven through the product store and public product API.
- Approved review aggregate data is used for public rating display.
- Rating UI is hidden when `reviewCount` is zero.
- Price, MRP, savings, and discount helpers reject invalid savings.
- Inventory-aware purchasability uses `stockQuantity - reservedQuantity` when available.
- Quantity controls cap at available stock or `maxOrderQuantity`.
- Pincode messaging is an estimate, not a guarantee.
- Variant and size selection is already represented without inventing SKU-level inventory.
- Primary product image uses eager/high-priority loading.
- Recommendation API is backend-driven and source-aware after 5E.1.
- Checkout and cart validation remain backend-authoritative.

## UX Problems

### 1. Reviews appear after recommendations

Problem: Recommendations and recently viewed sections render before customer reviews.

Why it matters: Reviews are trust proof; recommendations are secondary merchandising. Phase 5E.2 asks the customer to answer trust questions before browsing more products.

Current implementation: `ProductDetailPage.tsx` renders `recommendationSections`, fallback related products, and recently viewed before `<ProductReviews />`.

Recommended solution: Move reviews before recommendations/recently viewed. Keep recommendation loading non-blocking.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 2. Product-detail top panel is dense

Problem: Title, rating, price, availability, pincode, variants, quantity, CTAs, trust badges, details, and accordions are stacked in one long right column.

Why it matters: Customers need the answer to "what is it, how much, can I get it, how do I buy it" within seconds.

Current implementation: The content is present, but not visually separated into a compact purchase panel and lower informational sections.

Recommended solution: Tighten headings, reduce promotional styling, and make purchase actions and availability visually dominant without adding fake claims.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

## UI Problems

### 3. Some copy contains encoding artifacts

Problem: Several visible strings include mojibake such as `Â·`, `â€¢`, and `âœ•`.

Why it matters: Encoding artifacts make the product page feel unpolished and can hurt trust.

Current implementation: Variant pack labels, specifications text, and zoom close text contain malformed characters.

Recommended solution: Replace with ASCII separators and use a real icon or text for close controls.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 4. Trust cards use broad claims where neutral copy would be stronger

Problem: Trust cards are factual overall, but "Policy shown at checkout" for returns is weaker than linking to the return policy, and "Packed carefully" is not backed by a structured product field.

Why it matters: Trust copy should be specific, neutral, and verifiable.

Current implementation: Three static trust cards are rendered from local constants.

Recommended solution: Keep neutral shipping/packing copy, add a visible return-policy link, and avoid unsupported authenticity language.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

## Mobile Problems

### 5. Sticky purchase bar does not account for safe-area inset

Problem: Mobile sticky CTA uses fixed bottom positioning with normal padding.

Why it matters: On phones with gesture navigation, buttons can sit too close to the browser/OS edge.

Current implementation: Fixed bottom bar uses `bottom-0` and `py-2`.

Recommended solution: Add `padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))`, keep compact price, and make Add to Cart primary.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 6. Mobile sticky CTAs have weak hierarchy

Problem: Add Cart and Buy Now appear similarly weighted in the mobile bar.

Why it matters: Add to Cart should be the primary action; Buy Now should remain available but not compete visually.

Current implementation: Both mobile buttons use similar sizing and rely on global button classes.

Recommended solution: Give Add to Cart the maroon primary treatment and Buy Now an outlined secondary treatment.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

## Conversion Problems

### 7. Availability copy misses low-stock specificity

Problem: The page shows "ready for order" for any numeric available stock.

Why it matters: "Only 2 left" is allowed when backed by actual stock, while a generic message misses useful, truthful urgency.

Current implementation: `availableQuantity` is calculated but not used for low-stock wording.

Recommended solution: Show `Only N left` only when available stock is known and low according to `lowStockThreshold`.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

### 8. Quantity selector lacks explicit live context

Problem: Quantity changes are capped, but the customer only sees a small max message.

Why it matters: Clear limits reduce surprise before checkout validation.

Current implementation: Buttons clamp quantity to `quantityLimit` and show `Max N available` when inventory is known.

Recommended solution: Add clearer helper text when inventory-managed and disabled states are active.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

## Trust Problems

### 9. Open reviews need careful verified-purchase wording

Problem: Phase 5E.1/feedback changes allow open moderated reviews, but product detail still needs to distinguish customer feedback from verified purchase reviews.

Why it matters: Trust is preserved only if verified badges are never applied to open feedback.

Current implementation: `ProductReviews.tsx` shows `Verified Purchase` only when `isVerifiedPurchase` is true and uses approved reviews only.

Recommended solution: Keep this behavior and ensure product page rating summary remains aggregate-only.

Files affected: `frontend/src/components/reviews/ProductReviews.tsx`, `backend/src/routes/reviews.ts`.

Backend impact: None for 5E.2.

Database impact: None for 5E.2.

Risk: Low.

Priority: P1.

## Accessibility Problems

### 10. Variant button groups lack group-level semantics

Problem: Size, piece, and custom attribute choices use buttons with selected state, but not a complete radiogroup pattern.

Why it matters: Keyboard users can tab through controls, but screen-reader context can be clearer.

Current implementation: Individual buttons use `aria-pressed` only in some variant groups.

Recommended solution: Add `role="radiogroup"` and `role="radio"`/`aria-checked` to option groups while keeping buttons.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

### 11. Zoom overlay is custom and lacks full dialog polish

Problem: Image zoom uses a custom fixed overlay with click-away close but no dialog semantics or Escape handling.

Why it matters: Lightbox interactions should be keyboard understandable.

Current implementation: The overlay is a fixed div with a close button.

Recommended solution: Add `role="dialog"`, `aria-modal`, Escape close, and a clearer close control.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.

## Performance Problems

### 12. Product detail still has large hook dependency warnings

Problem: Existing `ProductDetailPage.tsx` has multiple hook dependency lint warnings.

Why it matters: They can hide stale UI state bugs when product/variant data changes.

Current implementation: Several hooks depend on complex expressions and suppress/expose warnings during lint.

Recommended solution: Avoid increasing this debt in 5E.2; schedule a focused hook cleanup later because it is high-churn.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Medium if refactored broadly.

Priority: P3.

## SEO Problems

### 13. SEO schema is strong but must retain truthful aggregate ratings only

Problem: Product schema includes aggregate rating only when product review count/rating are positive. This is correct but easy to regress while changing review UX.

Why it matters: Fake review schema is an SEO and trust risk.

Current implementation: JSON-LD uses `hasReviewRating(product)` before adding aggregate data.

Recommended solution: Preserve the guard and do not inject open/pending review data.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P1.

## Data Integrity Problems

### 14. Product detail uses frontend selection prices for display, while checkout remains authoritative

Problem: Variant/piece prices are calculated on the frontend for display and cart item payloads.

Why it matters: The frontend must not become payment authority.

Current implementation: Checkout validation reprices cart items server-side. Product detail should continue to present UI prices only.

Recommended solution: Keep existing checkout validation unchanged and avoid any backend/payment changes in 5E.2.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`, `backend/src/lib/orderPricing.ts`.

Backend impact: None.

Database impact: None.

Risk: Low if checkout remains authoritative.

Priority: P1.

## API Problems

### 15. Product-detail delivery estimate is settings-derived, not pincode serviceability-derived

Problem: Pincode check validates format and displays settings-derived ETA, not courier-specific product delivery data.

Why it matters: The wording must remain "estimated" and not "guaranteed".

Current implementation: `deliveryEtaMinDays`, `deliveryEtaMaxDays`, shipping fee, and free-shipping threshold come from public settings.

Recommended solution: Keep neutral estimate copy and avoid exact delivery dates unless a real serviceability API is integrated.

Files affected: `frontend/src/pages/ProductDetailPage.tsx`, `backend/src/routes/settings.ts`.

Backend impact: None.

Database impact: None.

Risk: Low.

Priority: P2.
