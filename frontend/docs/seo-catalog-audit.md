# SEO catalog build audit — 2 November 2026

The complete local production build now succeeds with the Production environment
values supplied by the owner. It prerenders 413 routes using 353 real products,
8 categories, 28 subcategories and 5 blog posts. No deployment or database change
was performed.

The reported failure is an HTTP failure of the **whole `/categories` resource**,
not an individual invalid category. There is no failing category ID/name to
report for that HTTP 500: entry validation and category rendering had not begun.
All current category entries and their generated pages pass the audit.

The original line `frontend/scripts/build-data.mjs:267` in commit `74665b7` is
the catch-and-rethrow wrapper. The originating frontend check was line 193
(`!response.ok`); `/categories` was fetched at line 241. The old readiness check
at line 238 accepted `/health` returning 200 without waiting for catalog requests.
`prerender-pages.mjs:11` consequently failed while awaiting data, before its
route rendering loop.

Earlier live API inspection in this investigation returned
`Runtime database DDL is disabled; apply reviewed migrations through the local-only migration command.`
from both categories and products. In backend commit `703f7be`,
`src/routes/categories.ts:16–30` defined `ensureSubcategoriesTable`, with
`CREATE TABLE IF NOT EXISTS` at line 18 and an unconditional call on category
GET at line 100. The runtime DDL guard rejects CREATE even if the table exists.
The backend correction is already in commit `74665b7`, but the supplied logs
show Vercel failing at 14:32:53 while Render's new instances became live at
14:33:23 and 14:34:17. An old instance could pass health and still return the
catalog error. These observations support deployment timing as the cause of the
reported build failure. The current backend has recovered; this audit cannot
reconstruct a different, unprovided failure from the generic wrapper alone.

The frontend now retries required product/category requests on network errors,
429 and 5xx within the shared bounded readiness window. Persistent errors still
fail the release. The database guard remains enabled. No missing-data fallback,
fake record, relaxed validation, or production migration was introduced.

The owner confirmed these Vercel Production values. They were reproduced
explicitly in the local release build; the Vercel account was not modified or
independently inspected through authenticated access.

| Setting | Confirmed value | Effect |
| --- | --- | --- |
| BUILD_API_BASE_URL | https://brajmart-1.onrender.com/api | Selected absolute catalog API |
| API_BASE_URL | /api | Ignored as a relative build API candidate |
| VITE_API_URL | /api | Browser API path |
| VITE_API_BASE_URL | /api | Browser API fallback |
| VITE_SITE_URL | https://www.brajmart.com | Canonical site configuration |

A separate configuration defect was independently reproduced:
`https://www.brajmart.com/api/categories` returned Vercel HTTP 404, while
`https://brajmart-1.onrender.com/api/categories` returned JSON HTTP 200. There
was no `/api` proxy in the repository's Vercel configuration. A scoped external
rewrite now forwards `/api/:path*` to the existing Render `/api/:path*`. Existing
page rewrites, redirects and headers are preserved. This uses Vercel's
[documented external rewrite mechanism](https://vercel.com/docs/routing/rewrites).
The proxy has not been published, so production still needs the reviewed change.

Read-only API comparisons found identical local and production response data
for products, categories, blogs, hero slides and settings, after canonicalizing
object key and array order. Both returned 353 products, 8 categories, 5 blogs
and 8 hero slides. No duplicate product/category slug route or product with an
unmatched category was found. The category distribution is:

| Category ID | Category | Route slug | Products | Subcategories |
| --- | --- | --- | ---: | ---: |
| 7 | BrajMart Special | brajmart-special | 8 | 0 |
| 4 | Books | books | 55 | 5 |
| 1 | Prasadam | prasadam | 17 | 4 |
| 8 | Accessories | accessories | 54 | 7 |
| 2 | Clothing | clothing | 18 | 3 |
| 6 | Groceries | groceries | 45 | 3 |
| 3 | Idols & Shringar | idols-shringar | 124 | 3 |
| 5 | Incense/Pooja Items | incense-pooja-items | 32 | 3 |

The audited generation flow is:

1. Vite builds the browser assets and `src/entry-server.tsx` SSR bundle.
2. `prerender-pages.mjs` calls `getBuildData`; environment precedence selects the
   absolute build API, health warms the backend, and required catalog requests
   retry within the readiness deadline.
3. Catalog validation checks response arrays, non-empty required collections,
   entry names/types, usable slugs and duplicate routes. Empty individual
   categories remain supported. Errors identify the collection, index and
   available ID/name/slug rather than dumping a response object.
4. Existing normalization and route selection create each page's hydration
   snapshot. The original slug mapping, routes, React renderer, metadata and
   canonical generation are retained. Render failures identify the route and
   associated catalog entry; empty SSR HTML fails explicitly.
5. Successful public data is cached for llms.txt and sitemap generation.
   Catalog fetch failures also write a sanitized diagnostic summary, with stage,
   selected setting name and request status. Credentials, URL query strings,
   bearer tokens and known environment secret values are redacted.
6. Existing llms and split-sitemap generators consume the successful snapshot;
   the sitemap generator removes that temporary cache. Generated build files
   were inspected, then verification-only changes to tracked public artifacts
   were removed from the review diff.

| Validation performed | Command / coverage | Result |
| --- | --- | --- |
| Catalog/fetch/diagnostic tests | `node --test scripts/build-data.test.mjs scripts/build-data-policy.test.mjs scripts/catalog-validation.test.mjs` | 28 passed |
| Category prerender tests | `node --test scripts/prerender-pages.test.mjs` | All 36 category/subcategory pages passed |
| Product prerender tests | Same artifact suite | All 353 product pages passed |
| Direct SSR tests | Same artifact suite | Real category and product rendered; 3 artifact test cases passed overall |
| Production build | `npm run build`, VERCEL=1 and VERCEL_ENV=production, exact owner-supplied URL settings | Passed; 413 public routes |
| Frontend regressions | `npm test -- --reporter=dot` | 88 passed across 10 files |
| Backend regressions | `npm test` in backend | 191 passed |
| SEO artifact checks | `npm run verify:seo` | Passed |
| Vercel route preservation | `npm run verify:vercel-routing` | Passed |
| Frontend TypeScript | `npm run typecheck` | Passed |

This is 310 passing automated test cases, plus SEO, routing and TypeScript
checks. Category/product artifact tests also verify one canonical per page,
structured data, matching product content, hydration data and sitemap inclusion.

The files changed by this audit are:

| File, relative to frontend | Purpose |
| --- | --- |
| scripts/build-data.mjs | Bounded readiness, configuration provenance, strict entry validation, sanitized diagnostics |
| scripts/catalog-validation.mjs | Entry and route validation; unchanged slug mapping |
| scripts/seo-diagnostics.mjs | Entry identity formatting and secret redaction |
| scripts/prerender-pages.mjs | Failure summaries and contextual rendering errors |
| scripts/prerender-diagnostics.mjs | Route-to-entry diagnostics and empty-HTML protection |
| scripts/build-data.test.mjs | Fetch, validation-stage and credential-redaction regressions |
| scripts/catalog-validation.test.mjs | Malformed entries, duplicate routes, SSR failures and redaction tests |
| scripts/prerender-pages.test.mjs | Real category/product HTML and direct SSR tests |
| scripts/verify-vercel-routing.mjs | API proxy assertion alongside existing route checks |
| vercel.json | Scoped Render API proxy |
| README.md | Configuration, diagnostic and verification instructions |
| docs/seo-catalog-audit.md | Audit evidence and review report |

Earlier pending changes are retained in `frontend/.env.example`,
`frontend/scripts/build-data-policy.test.mjs`, `backend/.env.example`,
`backend/README.md`, and `backend/tests/environment-origins.test.cjs`. Existing
runtime migrations and product/category database records were not changed in
this audit.

There is no current catalog-data or SSR blocker in the verified build. The
uncommitted changes still require owner review and a later deployment. The
new `/api` proxy cannot be verified on the public Vercel deployment until then.
The earlier CORS scope correction is also pending in Render if it has not been
applied: the scope is `itbrajmarts-projects`, as shown in the owner's Vercel URL.
