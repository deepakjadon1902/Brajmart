# SEO Rendering Deployment

## Architecture

Public storefront routes are rendered from the existing React components during the Vercel build and hydrated in the browser. Authentication, cart, checkout, profile, payment, and admin routes remain client-rendered.

The build deliberately fails on Vercel when the public catalog API is unavailable. This prevents publishing product URLs with empty HTML or stale sitemap entries.

## Required Vercel environment

Set `API_BASE_URL` to the public Render backend base URL. It may end with `/api`; both forms are supported. Keep the existing `VITE_API_URL`, OAuth, ImageKit, payment, and frontend variables unchanged.

Example shape (do not commit the real value):

```text
API_BASE_URL=https://your-render-service.example.com/api
VITE_SITE_URL=https://www.brajmart.com
```

## Preview deployment

1. Create a preview deployment from the SEO branch.
2. Confirm the build reports live product/category counts and does not report fallback data.
3. Inspect View Source for the homepage, one category, one subcategory, one product, one blog post, and each policy page.
4. Confirm source contains an H1, visible content, canonical, description, JSON-LD, and crawlable links.
5. Confirm login, Google OAuth callback, cart, wishlist, checkout, profile, orders, payment callbacks, uploads, and admin operations in the preview environment.

## Production promotion

Promote the verified preview deployment rather than rebuilding a different artifact:

```text
vercel promote <preview-deployment-url>
```

After promotion, submit `https://www.brajmart.com/sitemap-index.xml` in Search Console and inspect representative URLs. Do not submit filter, search, cart, login, profile, checkout, or parameter URLs.

## Verification

- `curl` or View Source must show populated `#root` HTML.
- Product source must include product name, description, price, image, availability, SKU, related products, breadcrumbs, canonical, and Product JSON-LD.
- Missing generated catalog paths must return a hosting-level 404 rather than a product shell.
- Validate products with Google Rich Results Test.
- Validate all sitemap files as XML and confirm every listed URL is canonical and returns HTTP 200.
- Monitor Search Console Page Indexing, Crawl Stats, Core Web Vitals, Product snippets, and Merchant listings after deployment.

## Rollback

Use Vercel's deployment rollback to restore the previous production artifact immediately:

```text
vercel rollback
```

No database migration is required for this rendering change. A code rollback consists of reverting the rendering commits and redeploying; Render, MySQL, OAuth, ImageKit, email, payment, and API data remain unchanged.
