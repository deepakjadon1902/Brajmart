# BrajMart Frontend

## Production SEO-critical environment

Set these in the frontend deployment environment before building:

```
VITE_API_URL=https://brajmart-1.onrender.com/api
VITE_API_BASE_URL=https://brajmart-1.onrender.com/api
VITE_SITE_URL=https://www.brajmart.com
API_BASE_URL=https://brajmart-1.onrender.com/api
BUILD_API_BASE_URL=https://brajmart-1.onrender.com/api
```

Prerender waits for the configured backend's `/api/health` endpoint and retries
temporary failures from `/api/products` and `/api/categories` within the same
readiness window. This covers simultaneous Vercel/Render deployments where the
old backend passes health checks before the new catalog code is running.
The default readiness window is 90 seconds; set
`BUILD_API_READY_TIMEOUT_MS` (up to 180000) if the backend needs longer during a
deployment. Network errors, HTTP 429, and HTTP 5xx on required catalog reads are
retried; other HTTP errors and invalid JSON fail immediately. Backend JSON error
messages are included in the build log. `BUILD_API_RETRIES` controls ordinary
retries on the other resources. The build still fails if the backend does not
recover or returns an empty catalog, so incomplete pages are not published.
Deploy the backend first when coordinating a manual production release.

If a build failed before the Render deployment finished, rerun the Vercel build
after checking `/api/categories` and `/api/products?view=detail` both return
HTTP 200. A running server and a successful `/api/health` alone do not confirm
that the catalog is ready. Run the build-fetch regression tests with
`node --test scripts/build-data*.test.mjs`.

The supplied Production settings (`BUILD_API_BASE_URL` pointing to Render,
relative `/api` browser URLs, and `VITE_SITE_URL=https://www.brajmart.com`) are
supported. The build uses the absolute build URL; `vercel.json` proxies browser
`/api/:path*` requests to that same Render backend. All existing page rewrites,
redirects, metadata, canonicals, and sitemap paths are retained.
See [Vercel external rewrites](https://vercel.com/docs/routing/rewrites).

Catalog diagnostics distinguish HTTP fetch failures from malformed catalog
entries and SSR failures. Validation errors include the collection, array index,
ID/name and relevant route; prerender errors identify their route and catalog
entry. URL credentials, query strings, bearer tokens and known environment
secrets are redacted. `.seo-build-data-meta.json` records the stage, selected API
setting name, sanitized request metadata and catalog validation counts.

Run `node --test scripts/build-data*.test.mjs scripts/catalog-validation.test.mjs`
for fetch and catalog validation tests. After a production build, run
`node --test scripts/prerender-pages.test.mjs` for every generated category and
product page plus direct SSR checks, followed by `npm run verify:seo` and
`npm run verify:vercel-routing`.

## Page loading after deployments

HTML documents revalidate on each visit, while hashed assets keep their immutable
cache policy. If an open tab requests a page file removed by a newer deployment,
the app reloads the current URL once for its loaded entry bundle. The guard
prevents reload loops and permits recovery again after another deployment.
Offline clients and browsers that block session storage show a reload button.
Persistent failures show readable guidance with technical details collapsed.
This covers lazy routes, cart-drawer loading, and prerendered page startup.

Run `npm test -- moduleLoadRecovery ErrorBoundary main.test` and
`npm run verify:vercel-routing` to check recovery and caching behavior.
