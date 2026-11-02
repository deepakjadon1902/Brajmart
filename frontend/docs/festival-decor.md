# Storefront festival decorations

Open **Admin → Settings → The festive edit**, then select **Diwali** or **Holi**. Each button saves immediately; the general Save Settings button is not needed. Only one festival is active at a time. **Turn decorations off** restores the original storefront. A failed save keeps the previous selection and displays a retryable error.

The selection belongs to the store, rather than an individual browser. New visitors fetch fresh settings shortly after startup; open storefronts refresh settings on focus and every minute. SSR/prerender includes the theme from the build's settings snapshot. Normal catalog validation, routes, metadata and sitemap generation continue unchanged.

Diwali uses original illustrated brass diyas, wax candles, rockets and sparklers, plus a marigold and mango-leaf toran. Holi uses coloured gulal bowls, water balloons, pichkaris and colour splashes, plus a floral toran. Objects decorate the edges of every storefront page and the footer without taking over product or hero space. They ignore pointer input. Checkout and payment pages use quieter edge decorations; administration and unsubscribe pages omit them. There is no festival banner.

A centred, dismissible festival greeting appears after the visitor first reaches the homepage in each application load. It opens again after a full refresh, including when settings arrive after startup. Closing it keeps it dismissed during normal navigation in that application load; returning home does not repeat it. A change to a different active festival can present the new greeting. It does not open on product pages, checkout, payment or admin routes. The greeting includes matching original illustrations, a festival wish, the store name, a close button and a Continue exploring action. Escape and outside click dismiss it; keyboard focus stays in the dialog while it is open. It is closed in SSR output and opens after hydration, preserving catalog HTML.

Product images and hero slides remain managed by their existing controls. Vector artwork stays sharp on high density screens without image downloads. Motion respects reduced-motion preferences; decorative SVGs are hidden from screen readers and printing.

Diwali also includes silent animated fireworks: a rising trail opens into a
ring of sparks, then falling embers fade out. Four staggered bursts run around
desktop page margins; phones and short landscape screens use two slower bursts
with twelve visible sparks each. Small matching bursts appear in the Diwali
greeting. They ignore all pointer input, pause in hidden tabs, and disappear
when reduced motion is requested. Checkout, payment, thank-you, admin and
unsubscribe routes do not run fireworks. Holi does not run Diwali fireworks.
The greeting close button has a 44px touch target; small-phone sizing and safe
area spacing keep the greeting and bottom decorations inside usable screen space.

## Persistence and release

The authenticated settings API accepts `festivalTheme: "none" | "diwali" | "holi"`. Invalid values return HTTP 400; only administrators may update settings. The preference is stored in the existing `settings.announcement_bar` JSON column and exposed as the top-level `festivalTheme` response field. This uses the existing presentation settings storage without a schema migration or runtime DDL. Announcement visibility and messages are independent; ordinary settings saves preserve the festival preference.

Release the backend and frontend changes together, then choose a festival in Admin Settings. Older backends default to no decoration; attempts to save against an older backend display an error rather than claiming success. No production settings or database records are changed by the tests.

## Verification

```sh
cd backend
npm test
npx tsc -p tsconfig.json --noEmit
cd ../frontend
npm test
npm run typecheck
npx playwright test --config playwright.festivals.config.ts
npm run build
node --test scripts/festival-prerender.test.mjs
```

Browser tests use isolated API fixtures. If using an installed Chrome instead of Playwright Chromium, set `PLAYWRIGHT_CHANNEL=chrome`. Screenshots are written to `.test-results/festival-*.png`.
