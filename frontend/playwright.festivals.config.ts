import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'festival-decor.spec.ts',
  workers: 1,
  timeout: 90_000,
  reporter: 'line',
  outputDir: '.test-results/festivals-browser',
  use: { ...base.use, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
});
