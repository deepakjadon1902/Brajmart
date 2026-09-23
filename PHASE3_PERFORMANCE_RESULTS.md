# Brajmart Phase 3 Performance Results

## Build Output

Latest production build passed.

- Main JS: 85.89 kB gzip
- CSS: 25.71 kB gzip
- HTML: 1.84 kB gzip

Phase 3 did not run live Lighthouse, so no field or Lighthouse metric improvement is claimed.

## Hydration Verification

Checked with Playwright against Vite preview on mobile viewport `390x844`.

Generated routes verified with no hydration/page errors:

- `/`
- `/products`
- `/about`
- `/categories`

Observed route chunks:

- `/`: no catalog/admin/cart drawer route chunk at startup
- `/products`: `ProductsPage-*.js`
- `/about`: `AboutPage-*.js`
- `/categories`: `CategoriesPage-*.js`

Expected local-only noise:

- External third-party/network requests reported `ERR_NETWORK_ACCESS_DENIED` or local API `500` while running in the sandboxed preview environment.
- These were not React hydration errors.

## Route Generation Note

The local build reported fallback SEO data because production catalog API calls returned HTTP 404. As a result, the local prerender step generated 0 product routes and no category/product route HTML for representative catalog detail verification. The prerenderer now writes both directory and `.html` aliases for every generated route, so catalog-backed builds can hydrate slashless product/category URLs from matching static documents.

## Runtime Startup Results

- Persisted settings/auth/cart/wishlist rehydration is skipped during initial store creation and deferred after startup.
- Persisted store rehydration runs during idle time and inside `startTransition`.
- Public settings refresh writes are wrapped in `startTransition`.
- Current public route chunks are preloaded before `hydrateRoot`.
- Cart drawer chunk remains absent from homepage startup unless the drawer is opened.

## Animation Result

The shimmer sweep now animates `transform: translateX(...)` instead of `left`, avoiding layout-position keyframes for that effect.

## Verification Commands

- `npm run build`
- Playwright hydration smoke against Vite preview

