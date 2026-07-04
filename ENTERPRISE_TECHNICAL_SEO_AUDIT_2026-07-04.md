# BrajMart Enterprise Technical SEO Audit

Date: 2026-07-04  
Scope: React/Vite frontend, Express backend, generated HTML, routing, crawl controls, sitemaps, schema, performance architecture, and live HTTP behavior.  
Change policy: production-safe, backward-compatible changes only.

## Executive finding

BrajMart is not a pure client-rendered site. Public pages are rendered with React on the server during the Vercel build, written as static HTML, and hydrated in the browser. Google receives product/category content, headings, metadata, links, and JSON-LD in the initial response for routes that existed at build time.

The strongest verified cause of the Search Console exclusions is the universal Vercel SPA fallback. Before this audit, every unknown URL—including a nonexistent `/product/...` URL—returned HTTP 200 with the homepage document. This creates soft 404s, duplicate homepage content on unlimited URLs, misleading canonicals, and crawl waste. The submitted sitemap contains 343 URLs while Search Console has discovered 2,500+, which is consistent with large-scale discovery of historical, parameter, typo, and soft-404 URLs.

## Verified rendering path

1. `vite build` produces the client bundle.
2. Vite's SSR build compiles `src/entry-server.tsx`.
3. `scripts/prerender-pages.mjs` downloads catalog data at build time and renders each public route.
4. Complete HTML is written to route-specific `dist/**/index.html` files.
5. Vercel serves those files; `main.tsx` hydrates when initial data and server markup are present.
6. Client-side refreshes update product/settings data after hydration.

Classification: build-time SSG/prerendering with React hydration and client-side data refresh. It is not request-time SSR.

Important limitation: products created after the last frontend deployment do not have prerendered route files until the next successful frontend build. The production build correctly fails closed when the catalog API is empty, but the Vercel deployment must retain a valid `API_BASE_URL`.

## Critical

### C1. Unknown and deleted URLs return HTTP 200 with homepage HTML

- Problem: arbitrary paths and nonexistent product paths returned 200.
- Root cause: final `/(.*) -> /index.html` rewrite in `frontend/vercel.json`.
- Affected files: `frontend/vercel.json`, `frontend/scripts/prerender-pages.mjs`.
- Google impact: soft 404s, duplicate content, incorrect canonical clustering, wasted crawl capacity, delayed validation.
- Business impact: broken external links appear valid and can show an unrelated homepage; product removals cannot produce reliable deletion signals.
- Solution implemented: generate a React `404.html`, remove the universal fallback, and explicitly allowlist legitimate client-only SPA routes.
- Priority: immediate / deployment-blocking.
- Regression risk: medium. Direct navigation to a legitimate route omitted from the allowlist would 404. The allowlist was matched against every route in `App.tsx`.
- Verification: after deployment, unknown root, product, category, and blog URLs must return 404; all listed account/admin/checkout routes must still load.

## High

### H1. Utility and private routes had incomplete noindex coverage

- Problem: compare, tracking, verification, OAuth, and admin routes were either only robots-blocked or lacked a consistent document/header noindex signal.
- Root cause: `NoIndexRoutes` covered only a subset of application routes; Vercel sent no `X-Robots-Tag`.
- Affected files: `frontend/src/App.tsx`, `frontend/vercel.json`, `frontend/public/robots.txt`.
- Google impact: crawl waste and possible URL-only indexing for blocked routes.
- Business impact: private/low-value pages can appear in search instead of revenue pages.
- Solution implemented: expand route-level noindex and add `X-Robots-Tag: noindex, nofollow` for utility/private paths.
- Priority: immediate.
- Regression risk: low; these routes are intentionally non-indexable.

### H2. Sitemap-to-discovered URL gap is approximately 7.3x

- Problem: 343 submitted URLs versus 2,500+ discovered URLs.
- Root cause: verified soft-404 acceptance plus historical redirects and parameter routes; exact GSC URL samples are required to quantify each source.
- Affected files: routing, robots, internal links, legacy redirect inventory.
- Google impact: crawl budget is diluted away from 314 product URLs and 29 other canonical content URLs.
- Business impact: new and updated product pages are crawled/indexed more slowly.
- Recommended solution: deploy C1/H1, resubmit only `sitemap-index.xml`, then export GSC examples by exclusion reason and group them by path/query pattern.
- Priority: immediate, then monitor for 4–8 weeks.

### H3. Indexable inventory is deployment-coupled

- Problem: a newly published product is client-visible through API refresh but is not guaranteed to have initial HTML or a valid direct static route until frontend redeployment.
- Root cause: build-time prerendering is the only HTML generation layer.
- Affected files: build/deployment workflow, `build-data.mjs`, `prerender-pages.mjs`.
- Google impact: delayed discovery or 404 after C1 for products published between deploys.
- Business impact: new inventory may lose launch traffic.
- Recommended solution: trigger a Vercel deploy hook after product/category/blog publish or unpublish. Do not migrate frameworks.
- Priority: high.

### H4. CI quality gates are not currently clean

- Problem: frontend lint reports 175 errors and 24 warnings; tests could not start under the managed filesystem sandbox. Backend TypeScript build passes.
- Root cause: accumulated TypeScript `any` usage, two empty-interface rules, hook dependency warnings, and environment-level Vitest access.
- Google impact: indirect; weak gates increase regression risk in SEO-critical rendering.
- Business impact: higher chance of storefront/admin regressions.
- Recommended solution: establish a baseline and reduce errors in isolated, tested batches; do not mix a repository-wide type cleanup with SEO deployment.
- Priority: high engineering hygiene, separate release.

## Medium

### M1. Product and category metadata templates can exceed search-display norms

- Problem: shared SEO component permits titles up to 120 characters and descriptions up to 220; category templates include repetitive commercial phrases.
- Root cause: truncation limits optimize for storage rather than typical search display.
- Affected files: `frontend/src/components/seo/SEO.tsx`, `frontend/src/lib/seo.ts`, page templates.
- Google impact: title rewriting and truncated snippets; not an indexing blocker.
- Business impact: weaker SERP clarity and CTR.
- Recommended solution: audit actual catalog distributions first, then target roughly 50–65 title characters and 140–165 description characters without blind truncation.
- Priority: medium.

### M2. Category depth is thin relative to product inventory

- Problem: only 8 category URLs and 2 blog URLs support 314 products; category copy is mostly shared template text.
- Root cause: limited editorial/category landing-page content.
- Affected files/data: category records, `categorySeo`, blog content.
- Google impact: weaker topical clusters and near-duplicate category signals.
- Business impact: fewer non-brand entry pages and limited buying-guide assisted conversion.
- Recommended solution: add unique category introductions, selection guidance, FAQs backed by visible content, and curated links to best sellers and guides.
- Priority: medium-high content program.

### M3. Product structured data is strong but merchant eligibility needs live validation

- Present: Product, Offer, brand, SKU, availability, INR price, shipping details, merchant return policy, aggregate rating when supported, and breadcrumbs.
- Risk: schema values depend on catalog/settings accuracy; review counts must represent genuine visible reviews.
- Affected file: `frontend/src/pages/ProductDetailPage.tsx`.
- Recommended solution: validate representative in-stock, out-of-stock, discounted, and variant products in Rich Results Test after each schema change. Never generate FAQ schema without matching visible FAQ content.
- Priority: medium.

### M4. Frontend initial payload remains substantial

- Evidence: main client chunks are approximately 219 KB, 163 KB, and 112 KB uncompressed; CSS is approximately 112 KB. The prerendered homepage response observed live was approximately 789 KB because catalog initial data is embedded.
- Root cause: homepage/products prerender data includes the full product catalog and is serialized into HTML.
- Google impact: potential parsing/main-thread and mobile LCP/INP cost; field CWV was not available in this audit environment.
- Business impact: slower mobile interaction can reduce conversion.
- Recommended solution: embed only products needed for the initial homepage sections, while retaining crawlable links to all products through category/pagination HTML and sitemaps.
- Priority: medium; measure before changing.

### M5. Security headers are minimal

- Evidence: live frontend includes HSTS but no verified CSP, Referrer-Policy, Permissions-Policy, or X-Content-Type-Options in sampled responses.
- Google impact: not a direct ranking issue.
- Business impact: defense-in-depth gap for an e-commerce storefront.
- Recommended solution: add headers incrementally, beginning with nosniff/referrer policy; deploy CSP in report-only mode before enforcement because payment, analytics, OAuth, ImageKit, and Resend-related origins must be mapped.
- Priority: medium; separate security release.

## Low

### L1. Duplicate sitemap index aliases

- Problem: `sitemap.xml`, `sitemap-index.xml`, and `sitemap_index.xml` contain the same index.
- Impact: low; only one is declared in robots and should be submitted in GSC.
- Recommendation: retain aliases for backward compatibility, submit only `sitemap-index.xml`.

### L2. `changefreq` and `priority` do not materially drive Google crawling

- Recommendation: keep for compatibility or remove later; accurate `lastmod` and clean canonical URLs matter more.

### L3. Browserslist data is stale

- Evidence: production build reports caniuse data 13 months old.
- Recommendation: update in a dependency-maintenance release after bundle/browser regression checks.

## Page-type disposition

| Page type | Intended state | Current architecture |
|---|---|---|
| Home | Index | Prerendered 200, self-canonical, schema, H1, internal product/category links |
| Products/categories/subcategories | Index when valid | Prerendered; filtered query variants noindex/crawl-blocked |
| Product | Index when valid | Prerendered with Product/Offer/Breadcrumb schema |
| Blog/list/post | Index when valid | Prerendered with article/breadcrumb metadata |
| Policy/about/contact/help | Index | Prerendered static content |
| Search/cart/checkout/wishlist/account/orders/admin/auth callbacks | Noindex | Client routes; header and meta noindex after this audit |
| Unknown/deleted URL | 404/noindex | Corrected by this audit; requires deployment verification |

## Search Console recovery sequence

1. Deploy and verify HTTP status behavior before starting validation.
2. Submit only `https://www.brajmart.com/sitemap-index.xml`.
3. Inspect one valid product, category, blog, and policy page with URL Inspection.
4. Test one deleted product and one random URL; both must be 404.
5. Export examples for each GSC exclusion bucket. Map by path and query pattern; do not request validation until the corresponding pattern is fixed.
6. Monitor indexed count, crawl requests, soft 404s, and duplicate canonical groups weekly. Validation can remain pending for weeks and is not itself evidence that a fix failed.

## CRO observations

- Strengths: strong catalog links from home, visible prices, add-to-cart/buy-now actions, trust bar, policies, related products, and mobile contact path.
- Risks: very large homepage HTML/data payload on mobile; trust copy such as “No duplicate items” is internally oriented and less persuasive than delivery/returns/payment reassurance; category content offers limited purchase guidance.
- Safe next work: measure product-to-cart and checkout-step abandonment in GA4, move the most decision-relevant delivery/return reassurance adjacent to the primary CTA, and add visible category buying guidance. Checkout changes require a separate funnel and payment regression plan.

## Verification evidence

- Live homepage: HTTP 200, server-rendered content visible without relying on client execution.
- Live valid product: HTTP 200 and route-specific static document.
- Live unknown root path before fix: HTTP 200 homepage document.
- Live unknown product before fix: HTTP 200 homepage document.
- Preferred host: non-www redirects to `https://www.brajmart.com/`.
- Robots and sitemap: HTTP 200; 314 products, 8 categories, 2 blogs, 19 static pages.
- Frontend production build: completed client and SSR compilation and produced `dist/404.html` with noindex and rendered H1.
- Backend TypeScript build: passed.
- Frontend lint: failed on pre-existing baseline (175 errors, 24 warnings).

