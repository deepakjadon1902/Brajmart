# Brajmart Phase 5 Performance Audit

## Scope and methodology

Phase 5 targeted catalog API payload, repeat schema-initialization work, network transfer, and startup CPU without changing payment, checkout, inventory, authentication, image delivery, prerender, or SEO behavior.

Measurements used a production frontend build, Vite preview, Playwright resource timing, the Long Tasks API, DOM inspection, and direct inspection of the live public API. Lighthouse CLI was unavailable, so this report does not invent Lighthouse scores or claim changes to Lighthouse TBT, INP, or performance scores.

## Baseline evidence

Three warm desktop and three emulated-mobile homepage runs were captured before Phase 5 changes. Median custom measurements were:

| Metric | Desktop | Mobile |
| --- | ---: | ---: |
| TTFB | 16 ms | 15 ms |
| DOMContentLoaded | 357 ms | 322 ms |
| LCP candidate | 352 ms | 300 ms |
| Long tasks | 6 | 6 |
| Fetch encoded bytes | 61,341 | 61,341 |
| Fetch decoded bytes | 495,913 | 495,913 |
| DOM nodes | 9,185 | 9,185 |

One desktop cold-like run reached 7.36 seconds LCP while third-party/local-preview work settled. It is retained in the raw artifact and excluded from warm-run medians rather than hidden or averaged into an unrepresentative result.

The desktop LCP candidate was an `H1` in homepage product content (`Prasadam` or `Seva Vigrahas`). The mobile candidate was a linked title in Purpose Discovery (`Radha-Krishna...`). These were text candidates, not the hero image, so resource load delay and resource load duration are not applicable. Warm render delay was approximately 337 ms desktop and 285 ms mobile after TTFB.

## Catalog payload audit

### Major optimization record

- **PROBLEM:** Public catalog/list consumers received full product-domain objects.
- **EVIDENCE:** The 346-product live response was 482,321 raw bytes; browser fetch resources decoded to 495,913 bytes at baseline.
- **ROOT CAUSE:** `/api/products` always used `mapProductRow`, regardless of whether the caller was a storefront list, admin, or prerender consumer.
- **IMPLEMENTATION:** Added a compact default list DTO, an explicit `view=detail` representation, representation-aware caching, and full-detail requests for admin and build consumers.
- **FILES:** `backend/src/routes/products.ts`, `frontend/src/lib/api.ts`, `frontend/src/store/productStore.ts`, and `frontend/scripts/build-data.mjs`.
- **BEFORE:** 482,321 raw / 59,345 gzip / 46,880 Brotli bytes for the captured live catalog; 61,341 encoded and 495,913 decoded homepage fetch bytes.
- **AFTER:** Projected catalog 311,870 raw / 48,921 gzip / 39,219 Brotli bytes; measured preview fetch resources 51,678 encoded and 325,462 decoded bytes.
- **MEASURED IMPACT:** Homepage fetch traffic fell 9,663 encoded bytes (15.8%) and 170,451 decoded bytes (34.4%). Deployed API savings remain a projection until release.
- **CORRECTNESS RISK:** Missing fields could break admin editing, prerender/SEO, search, card hover, purchasability, or cart snapshots.
- **VALIDATION:** Full detail is explicit for admin/prerender, detail-by-slug is unchanged, 406-route build and SEO verification passed, seven tests passed, and six public routes passed browser smoke tests.

The live `/api/products` response contained 346 products and measured 482,321 raw bytes. Local compression of the exact response produced 59,345 gzip bytes and 46,880 Brotli bytes. The largest fields were `description` (72,139 bytes), `metaDescription` (56,925), `images` (53,417), `image` (28,173), and `metaTitle` (16,003).

The default public list representation now removes fields that card/catalog consumers do not need:

- `_id`, `metaTitle`, `metaDescription`
- `sizes`, `sizePricing`, `piecePricing`
- `attributes`, `variantPricing`, `colorVariants`
- `reservedQuantity`, `lowStockThreshold`
- `archivedAt`, `archivedBy`, `archiveReason`

It preserves identifiers, names, slugs, prices, primary and hover images, category data, ratings, badges, tags, availability/COD signals, `stockQuantity`, SKU, sold count, description, and timestamps. Description remains because storefront search currently consumes it. At most two list images are serialized for card hover behavior.

Full product objects remain available through `GET /api/products?view=detail`. Admin catalog loading and build-time prerender explicitly request that representation. `GET /api/products/:slug` is unchanged.

Applying the list DTO to the captured live response projects 311,870 raw bytes, 48,921 gzip bytes, and 39,219 Brotli bytes: reductions of 170,451 raw, 10,424 gzip, and 7,661 Brotli bytes. This is a projection until the backend is deployed.

## Database and endpoint audit

`GET /api/products` performs one joined query with an approved-review aggregate; no per-product N+1 was found. It still selects `p.*` and maps complete rows before applying the public DTO. The Phase 5 change therefore reduces serialization and transfer but not yet database row width.

Public collection requests previously executed `CREATE TABLE IF NOT EXISTS` checks repeatedly. Collection schema setup is now guarded by one shared per-process promise. Public bundle reads had the same pattern, including table creation and a duplicate-safe `ALTER TABLE`; commerce-intelligence schema setup now also runs once per process.

No production database connection, `EXPLAIN`, or index mutation was performed. Index recommendations would be guesswork without the live schema, cardinality, and execution plans, so no index was added.

The existing product response policy remains `public, max-age=60, stale-while-revalidate=300`; `fresh=1` remains `no-store`. The in-process product cache is now representation-aware, preventing list and detail payloads from sharing the same cache entry. No ETag was added. Existing Express compression remains enabled.

## Consumer and correctness audit

Verified consumers include the storefront product store, Product Card, Products page search/purpose filtering, product details, admin product editing/export, and build-time SEO/prerender data. Admin and build consumers request full detail; public list consumers use the smaller DTO.

No checkout, payment, order, cart pricing, inventory mutation, reservation, authentication, or product-detail endpoint code changed. Existing frontend tests passed (2 files, 7 tests). The production build and SEO verification passed with 406 prerendered routes: 346 product, 36 category/subcategory, 5 blog, and 19 static routes.

## Final measurements

Three warm desktop and three emulated-mobile homepage runs after the change produced:

| Metric | Before desktop | After desktop | Before mobile | After mobile |
| --- | ---: | ---: | ---: | ---: |
| Median TTFB | 16 ms | 19 ms | 15 ms | 15 ms |
| Median DOMContentLoaded | 357 ms | 396 ms | 322 ms | 328 ms |
| Median LCP candidate | 352 ms | 400 ms | 300 ms | 312 ms |
| Median long tasks | 6 | 6 | 6 | 6 |
| Fetch encoded bytes | 61,341 | 51,678 | 61,341 | 51,678 |
| Fetch decoded bytes | 495,913 | 325,462 | 495,913 | 325,462 |

The measured fetch bucket fell 9,663 encoded bytes (15.8%) and 170,451 decoded bytes (34.4%). Document and CSS transfer were unchanged. Main script encoded size moved from 85,885 to 85,942 bytes in resource timing, a 57-byte difference. Warm LCP and DOMContentLoaded variation is within this small local sample and is not claimed as an improvement.

Clean-route smoke tests covered `/`, `/products`, `/about`, `/categories`, `/category/accessories`, and a representative product route. They produced no page errors and did not load the Cart Drawer chunk. A separate open-cart interaction rerun was not completed because the environment denied the required preview-server approval after its usage limit was reached.

## Build and quality gates

- Backend TypeScript build: passed.
- Frontend production build: passed.
- Main JS: 85.94 kB gzip; CSS: 25.71 kB gzip; shell HTML: 1.84 kB gzip.
- Homepage HTML: 360,483 raw / 53,889 gzip / 42,583 Brotli bytes.
- Products HTML: 519,571 raw / 68,271 gzip / 53,932 Brotli bytes.
- SEO verification: passed.
- Frontend tests: 7 passed.
- Focused frontend lint: blocked by pre-existing `no-explicit-any` errors in `api.ts` and `productStore.ts`; `build-data.mjs` was clean.
- Backend focused lint: not run because the project has no backend lint script and package-registry access for `npx eslint` was denied.
- Dedicated Lighthouse and axe runs: unavailable; accessibility and Lighthouse scores are not claimed.

## Files changed in Phase 5

- `backend/src/routes/products.ts`
- `backend/src/routes/collections.ts`
- `backend/src/lib/commerceIntelligence.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/store/productStore.ts`
- `frontend/scripts/build-data.mjs`

## Remaining bottlenecks

The next evidence-gathering priorities are post-deploy mobile/desktop Lighthouse, field-specific SQL projection with real query plans, database index inventory, deployed collection/bundle latency, DOM size (9,185 nodes), third-party CPU/transfer, and field-level search architecture that could eventually remove descriptions from the catalog list. These are Phase 6 candidates; Phase 6 was not started.
