import { test as base } from '@playwright/test';
export { expect, type Page } from '@playwright/test';

// Each test supplies its own API/provider mocks. Unmatched traffic must never
// reach a real order API, payment service, or analytics destination.
export const test = base.extend<{ isolatedNetwork: void }>({
  isolatedNetwork: [async ({ context }, use) => {
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ status: 503, json: { message: 'Unmocked API request blocked by test isolation' } });
      }
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return route.abort('blockedbyclient');
      return route.continue();
    });
    await use();
  }, { auto: true }],
});
