# Brajmart Phase 3 Performance Audit

Phase 3 focused on hydration correctness, prerender determinism, safe route splitting, deferred runtime startup, and compositor-safe animation. Phase 1 image work and Phase 2 startup work were preserved.

## Scope

- Audited SSR/prerender entrypoints: `frontend/scripts/prerender-pages.mjs`, `frontend/src/entry-server.tsx`, `frontend/src/ServerApp.tsx`, and `frontend/src/main.tsx`.
- Audited client route startup in `frontend/src/App.tsx`.
- Audited persisted Zustand stores that can update during hydration.
- Audited generated static route behavior under Vite preview.
- Audited shimmer animation for layout-affecting keyframes.

## Findings

1. Server and client app chrome did not fully match for prerendered hydration because `MobileBottomNav` was present only on the client route tree. Phase 3 made the server tree include the same storefront chrome.
2. Persisted Zustand stores could rehydrate synchronously while React was hydrating prerendered HTML. Phase 3 enabled `skipHydration` for persisted stores and schedules rehydration after startup idle time inside `startTransition`.
3. Public prerendered routes were hydrated behind Suspense boundaries. Even when route chunks were available, those boundaries could report React error `#421` when store or effect updates arrived before hydration completed. Phase 3 replaced Suspense-based public route loading with a preloadable stateful route loader.
4. Vite preview served `/products/` from `dist/products/index.html`, but slashless `/products` fell back to the root document. Phase 3 writes route HTML aliases such as `dist/products.html` in addition to directory `index.html` files, so slashless static preview routes receive the matching prerendered document.
5. The shimmer effect animated `left`, which can trigger layout/paint work. Phase 3 moved shimmer sweep animation to `transform`.

## Architecture Decisions

- Homepage stays statically imported and is not hidden behind client-only deferred rendering.
- Public prerendered routes remain code split, but their chunks are preloaded before `hydrateRoot` for the current URL.
- Public route navigation fallback uses local component state instead of Suspense, avoiding hydration-sensitive Suspense markers on prerendered documents.
- App-only/private/admin routes continue using lazy imports with Suspense boundaries.
- Below-fold and persisted runtime refreshes remain deferred; no marketing scripts were restored to eager startup.

## Limitations

The local build environment could not fetch live catalog API data and prerendered 0 product routes. Hydration verification therefore covered generated public routes available in this build: `/`, `/products`, `/about`, and `/categories`. Category/product detail hydration should be re-run after a catalog-backed production build generates those route files.

## Files Changed

- `frontend/src/App.tsx`
- `frontend/src/ServerApp.tsx`
- `frontend/src/main.tsx`
- `frontend/src/index.css`
- `frontend/src/store/authStore.ts`
- `frontend/src/store/cartStore.ts`
- `frontend/src/store/settingsStore.ts`
- `frontend/src/store/wishlistStore.ts`
- `frontend/scripts/prerender-pages.mjs`

