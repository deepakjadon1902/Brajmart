import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.PHASE7_BASE_URL || 'http://127.0.0.1:4178';
const output = process.env.PHASE7_CART_OUTPUT || 'phase7-cart-measurement.json';
const runCount = Number(process.env.PHASE7_RUNS || 5);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
};

const browser = await chromium.launch({ headless: true });
const results = { createdAt: new Date().toISOString(), baseUrl, direct: [], intent: [] };

for (const mode of ['direct', 'intent']) {
  for (let run = 1; run <= runCount; run += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(750);

    const button = page.locator('.product-card .add-to-cart-btn:visible').first();
    const loadedAtStart = await page.evaluate(() =>
      performance.getEntriesByType('resource').some((entry) => entry.name.includes('CartDrawer'))
    );

    let intentLeadMs = 0;
    if (mode === 'intent') {
      const intentStarted = Date.now();
      await button.hover();
      await page.waitForFunction(() =>
        performance.getEntriesByType('resource').some((entry) => entry.name.includes('CartDrawer') && entry.responseEnd > 0)
      );
      intentLeadMs = Date.now() - intentStarted;
    }

    const started = await page.evaluate(() => performance.now());
    if (mode === 'direct') {
      await button.evaluate((element) => element.click());
    } else {
      await button.click();
    }
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const openMs = Math.round((await page.evaluate(() => performance.now())) - started);
    const resource = await page.evaluate(() => {
      const entry = performance.getEntriesByType('resource').find((item) => item.name.includes('CartDrawer'));
      return entry ? {
        name: entry.name,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      } : null;
    });

    results[mode].push({ run, loadedAtStart, intentLeadMs, openMs, resource });
    await context.close();
  }
}

await browser.close();
results.summary = {
  directOpenMs: median(results.direct.map((run) => run.openMs)),
  intentOpenMs: median(results.intent.map((run) => run.openMs)),
  intentLeadMs: median(results.intent.map((run) => run.intentLeadMs)),
  improvementMs: median(results.direct.map((run) => run.openMs)) - median(results.intent.map((run) => run.openMs)),
};

await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results.summary, null, 2));
