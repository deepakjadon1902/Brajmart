import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'meta-ads.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1365, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
