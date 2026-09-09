# Brajmart AI And Search Discoverability

## Purpose

Brajmart exposes machine-readable public resources so compatible crawlers, search engines, and AI-powered discovery systems can understand the public storefront. This does not guarantee crawling, indexing, ranking, rich results, or recommendations by any external platform.

## Public Discovery Resources

- `/robots.txt` defines crawl restrictions for private, transactional, query-parameter, account, checkout, admin, and API routes.
- `/sitemap.xml` and `/sitemap-index.xml` list canonical, indexable public URLs only.
- `/llms.txt` summarizes the public site, catalog structure, policy pages, sitemap locations, and a compact sample of public products/blogs.

## Generation

Frontend production builds run:

```text
npm run build
```

The build sequence prerenders public React routes, generates `llms.txt`, and then generates split XML sitemaps. `llms.txt` and sitemaps use `frontend/scripts/build-data.mjs`, which reads the public API through `API_BASE_URL`, `VITE_API_BASE_URL`, or `VITE_API_URL`.

For production, configure:

```text
API_BASE_URL=https://your-backend.example.com/api
VITE_SITE_URL=https://www.brajmart.com
SEO_STRICT_BUILD=true
```

`SEO_STRICT_BUILD=true` prevents publishing empty catalog HTML if the public catalog API is unavailable.

## Public And Private URL Policy

Indexable public routes include homepage, products, product detail pages, categories, category/subcategory pages, published blog pages, Braj Darshan pages, contact, about, help center, customer service, and public policy pages.

Private or non-indexable routes include admin, API, authentication, account/profile, cart, checkout, compare, wishlist, order tracking, payment status, OAuth callbacks, verification, search, and query-parameter filter/sort/page URLs.

## Structured Data

The storefront emits JSON-LD through React Helmet during prerendering:

- Organization and WebSite data on the homepage.
- Product data on product pages with real visible price, availability, image, category, SKU, and aggregate rating only when review count/rating exist.
- BreadcrumbList on product, category, blog, and policy/information pages.
- BlogPosting on published blog detail pages.
- CollectionPage/ItemList on category and product listing pages.

Do not add fake ratings, reviews, FAQs, business identifiers, social profiles, addresses, or inventory details solely for SEO.

## Validation

Run these commands before deployment:

```text
cd frontend
npm run build
npm run verify:seo
```

```text
cd backend
npm run build
```

After deployment, verify actual production responses:

```text
https://www.brajmart.com/
https://www.brajmart.com/robots.txt
https://www.brajmart.com/sitemap.xml
https://www.brajmart.com/sitemap-index.xml
https://www.brajmart.com/llms.txt
```

Also inspect one product, one category, one blog post, and one nonexistent URL. Confirm HTTP status, canonical tags, metadata, JSON-LD, and visible crawlable content.
