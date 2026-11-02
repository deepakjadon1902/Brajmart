import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: ['checkout-safe.spec.ts', 'purchase-confirmation.spec.ts'],
  workers: 1,
  timeout: 90_000,
  reporter: 'line',
  outputDir: '.test-results/payments-browser',
  use: { ...base.use, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
});
