# BrajMart Frontend

## Production SEO-critical environment

Set these in the frontend deployment environment before building:

```
VITE_API_URL=https://brajmart-1.onrender.com/api
VITE_API_BASE_URL=https://brajmart-1.onrender.com/api
VITE_SITE_URL=https://www.brajmart.com
API_BASE_URL=https://brajmart-1.onrender.com/api
```

Prerender waits for the configured backend's `/api/health` endpoint before
fetching catalog data. The default readiness window is 90 seconds; set
`BUILD_API_READY_TIMEOUT_MS` (up to 180000) if the backend needs longer during a
deployment. The build still fails if the backend does not become ready or its
catalog endpoints fail, so incomplete product/category pages are not published.
Deploy the backend first when coordinating a manual production release.
