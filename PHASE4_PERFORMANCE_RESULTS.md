# Brajmart Phase 4 Performance Results

## Build State

Catalog-backed frontend build passed with:

- Main JS: `85.89 kB gzip`
- CSS: `25.71 kB gzip`
- HTML shell: `1.84 kB gzip`
- Prerendered routes: `406`
- Product routes: `346`
- Category/subcategory routes: `36`
- Blog routes: `5`
- Static routes: `19`

Build data source:

- API base: `https://brajmart-1.onrender.com/api`
- Ignored relative API value: `/api`
- Products fetched: `346`
- Categories fetched: `8`
- Blogs fetched: `5`
- Hero slides fetched: `8`
- Settings fetched: `1`

## Phase 4 Changes

- Fixed build-time API resolution so relative `/api` values are not converted into the frontend origin during prerender.
- Added explicit `BUILD_API_BASE_URL` support for production builds.
- Added build API request timeout/retry handling and request metadata output.
- Preserved the full `.seo-build-data-cache.json` contract for sitemap and llms generation.
- Added `.seo-build-data-meta.json` as ignored diagnostic output.
- Trimmed homepage serialized catalog data to the homepage-rendered product set while keeping full catalog data on catalog routes.

## Measured Impact

Homepage prerender payload:

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Raw HTML | 560,756 B | 360,483 B | -200,273 B |
| Gzip HTML | 74,166 B | 53,889 B | -20,277 B |
| Brotli HTML | 58,685 B | 42,598 B | -16,087 B |
| Serialized products | 346 | 199 | -147 |

Catalog route correctness:

- `/products` keeps `346` products and `catalogComplete: true`.
- `/` uses `199` route-scoped products and `catalogComplete: false`, so the background freshness path still refreshes the full catalog.

## Validation Results

- `npm run build` with `BUILD_API_BASE_URL=https://brajmart-1.onrender.com/api`: passed.
- `npm run verify:seo`: passed.
- `npm test`: passed, 7 tests.
- `npx eslint scripts/build-data.mjs scripts/prerender-pages.mjs`: passed.
- `backend npm run build`: passed.
- Local preview smoke: no hydration/page exceptions on representative public routes.

## Remaining Risks

- No live post-deploy Lighthouse numbers were captured.
- Public API `/products` is still a large 482,321-byte compressed response.
- Empty `/collections` and `/bundles?location=home&limit=3` responses are still slow despite returning `[]`.
- DB EXPLAIN/index validation remains blocked until a safe non-production database connection is available.

