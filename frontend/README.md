# BrajMart Frontend

## Production SEO-critical environment

Set these in the frontend deployment environment before building:

```
VITE_API_URL=https://your-backend-domain.example.com/api
VITE_API_BASE_URL=https://your-backend-domain.example.com/api
VITE_SITE_URL=https://www.brajmart.com
API_BASE_URL=https://your-backend-domain.example.com/api
```

The sitemap generator runs before `vite build`. If `API_BASE_URL`/`VITE_API_URL`
does not point to the live backend, `sitemap.xml` will contain only static
pages and product/category/blog URLs will be missing.
