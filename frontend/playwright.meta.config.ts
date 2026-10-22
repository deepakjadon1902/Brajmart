import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['meta-ads.spec.ts', 'purchase-confirmation.spec.ts', 'checkout-safe.spec.ts'],
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '.test-results/tracking',
  use: { browserName: 'chromium', headless: true, baseURL: 'http://127.0.0.1:4178', serviceWorkers: 'block' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: '/api', VITE_ENABLE_LEGACY_GTM: 'false' },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1365, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
