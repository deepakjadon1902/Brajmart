# Brajmart Phase 4 Performance Audit

Phase 4 focused on JavaScript execution, main-thread work, route startup, and the build-time catalog/API path that powers prerendered public pages.

## Executive Summary

- The catalog prerender failure was traced to frontend build env using relative `/api` values. The build script converted that into `https://www.brajmart.com/api`, which returns 404 because the public backend API is hosted at `https://brajmart-1.onrender.com/api`.
- `frontend/scripts/build-data.mjs` now requires an absolute build API URL, supports `BUILD_API_BASE_URL`, ignores unsafe relative API values for Node prerender, records request timings/status/byte counts, and falls back to selected `BACKEND_URL` from `backend/.env` only for local builds.
- `frontend/scripts/prerender-pages.mjs` now preserves the full SEO cache contract while writing a compact metadata summary for diagnostics.
- A catalog-backed build fetched 346 products, 8 categories, 5 blogs, 8 hero slides, and prerendered 406 public routes.
- Homepage initial data was trimmed from the full 346-product catalog to the 199 products actually needed by homepage sections, while `/products`, category routes, and product-detail routes retain complete route data where needed.

## Root Cause: Catalog API 404

Problem:
The build-time data loader accepted relative API env values such as `/api` in a Node build context.

Evidence:

- `frontend/.env` contains `API_BASE_URL=/api`, `VITE_API_URL=/api`, and `VITE_API_BASE_URL=/api`.
- Production frontend origin check: `https://www.brajmart.com/api/products` returned HTTP 404.
- Public backend check: `https://brajmart-1.onrender.com/api/products` returned HTTP 200 and 482,321 compressed response bytes.

Root cause:
The build script resolved relative `/api` against `VITE_SITE_URL=https://www.brajmart.com`, but Vercel does not serve the Express catalog API at that origin.

Fix:
Use an absolute build API base for Node prerender: `BUILD_API_BASE_URL` first, then `API_BASE_URL`, `BACKEND_URL`, `VITE_API_URL`, and `VITE_API_BASE_URL`, accepting only absolute `http(s)` values. Relative values are ignored and reported.

Files:

- `frontend/scripts/build-data.mjs`
- `frontend/scripts/prerender-pages.mjs`
- `.gitignore`

## API Measurements

Read-only public API timings captured from this workstation:

| Endpoint | Status | Bytes | Cache-Control | Timings |
| --- | ---: | ---: | --- | --- |
| `/health` | 200 | 54 | none observed | 643 / 365 / 811 ms |
| `/products` | 200 | 482,321 | `public, max-age=60, stale-while-revalidate=300` | 408 / 811 / 564 ms |
| `/categories` | 200 | 8,589 | `public, max-age=60, stale-while-revalidate=300` | 1739 / 288 / 794 ms |
| `/blogs` | 200 | 4,267 | none observed | 686 / 630 / 555 ms |
| `/hero-slides` | 200 | 3,664 | `public, max-age=60, stale-while-revalidate=300` | 625 / 287 / 361 ms |
| `/settings` | 200 | 1,337 | `public, max-age=300, stale-while-revalidate=600` | 647 / 292 / 334 ms |
| `/collections` | 200 | 2 | `public, max-age=60, stale-while-revalidate=300` | 1588 / 1095 / 1044 ms |
| `/bundles?location=home&limit=3` | 200 | 2 | `public, max-age=60, stale-while-revalidate=300` | 2094 / 1398 / 1583 ms |

The empty collection/bundle responses are small but slow. DB-level EXPLAIN or index validation was not performed because starting the local backend would connect to the configured database and was rejected for safety.

## JavaScript and Route Startup Findings

- Main client bundle remains `85.89 kB gzip`; Phase 4 did not increase it materially.
- Route splitting remains active: product/category/detail pages load their route chunks on demand.
- Local preview hydration smoke showed no page exceptions on `/`, `/products`, `/about`, `/categories`, `/category/accessories`, or `/product/2-round-tulsi-kanthi-mala-natural-tulsi-beads`.
- `CartDrawer` stayed out of the tested public routes until needed.
- Third-party scripts still appear in local preview after startup deferral; live CPU cost still needs Lighthouse or Chrome trace measurement after deployment.

## Payload Results

Before the homepage route-scoped catalog trim, a catalog-backed prerender produced:

- `frontend/dist/index.html`: 560,756 raw bytes, 74,166 gzip, 58,685 brotli
- `frontend/dist/products.html`: 519,571 raw bytes, 68,270 gzip, 53,935 brotli

After the trim:

- `frontend/dist/index.html`: 360,483 raw bytes, 53,889 gzip, 42,598 brotli
- `frontend/dist/products.html`: 519,571 raw bytes, 68,270 gzip, 53,941 brotli

Measured impact:

- Homepage raw HTML: -200,273 bytes
- Homepage gzip: -20,277 bytes
- Homepage brotli: -16,087 bytes
- Homepage serialized products: 346 -> 199
- `/products` remains complete: 346 serialized products

## Validation

- Production-like catalog-backed frontend build: passed.
- Backend TypeScript build: passed.
- SEO verification: passed.
- Frontend tests: passed, 7 tests across 2 files.
- Focused ESLint for changed scripts: passed.
- Local preview hydration smoke: passed for representative public routes.

Limitations:

- Post-deploy Lighthouse was not measured in this environment because the Lighthouse CLI is not installed.
- Local backend startup was not continued because it attempted to connect to the configured database and escalation was rejected to avoid accidental production DB/migration side effects.
- DB query plans and index verification remain unmeasured.

