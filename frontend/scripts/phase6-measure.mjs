import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.PHASE6_BASE_URL || 'http://127.0.0.1:4178';
const output = process.env.PHASE6_OUTPUT || 'phase6-measurement.json';
const profiles = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
};

const browser = await chromium.launch({ headless: true });
const result = { createdAt: new Date().toISOString(), baseUrl, profiles: {} };

for (const [profile, options] of Object.entries(profiles)) {
  const runs = [];
  for (let run = 1; run <= 3; run += 1) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__phase6 = { longTasks: [], lcp: [], cls: 0, shifts: [], events: [] };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__phase6.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name });
        }
      }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__phase6.lcp.push({
            startTime: entry.startTime,
            element: entry.element?.tagName || '',
            text: entry.element?.textContent?.trim().slice(0, 80) || '',
            url: entry.url || '',
          });
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__phase6.cls += entry.value;
            window.__phase6.shifts.push({
              startTime: entry.startTime,
              value: entry.value,
              sources: (entry.sources || []).map((source) => ({
                node: source.node ? `${source.node.tagName}.${String(source.node.className || '').split(/\s+/).slice(0, 3).join('.')}` : '',
                previousRect: source.previousRect,
                currentRect: source.currentRect,
              })),
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__phase6.events.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              processingStart: entry.processingStart,
              processingEnd: entry.processingEnd,
              interactionId: entry.interactionId,
            });
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      } catch {}
    });

    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/`, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(1_500);

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const buckets = {};
      for (const resource of resources) {
        const url = new URL(resource.name, location.href);
        const firstParty = url.origin === location.origin;
        const key = firstParty ? resource.initiatorType : `third-party:${url.hostname}`;
        const bucket = buckets[key] ||= { count: 0, transfer: 0, encoded: 0, decoded: 0, duration: 0 };
        bucket.count += 1;
        bucket.transfer += resource.transferSize || 0;
        bucket.encoded += resource.encodedBodySize || 0;
        bucket.decoded += resource.decodedBodySize || 0;
        bucket.duration += resource.duration || 0;
      }
      const sections = [...document.querySelectorAll('body > #root > div > main > *')].map((element, index) => ({
        index,
        tag: element.tagName,
        className: String(element.className || '').slice(0, 160),
        heading: element.querySelector('h1,h2,h3')?.textContent?.trim().slice(0, 100) || '',
        nodes: element.querySelectorAll('*').length + 1,
        cards: element.querySelectorAll('.product-card').length,
        hidden: getComputedStyle(element).display === 'none' || getComputedStyle(element).visibility === 'hidden',
        top: Math.round(element.getBoundingClientRect().top + scrollY),
      }));
      const cards = [...document.querySelectorAll('.product-card')];
      return {
        nav: {
          ttfb: nav.responseStart,
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          domContentLoaded: nav.domContentLoadedEventEnd,
          load: nav.loadEventEnd,
          transfer: nav.transferSize,
          encoded: nav.encodedBodySize,
          decoded: nav.decodedBodySize,
        },
        lcp: window.__phase6.lcp.at(-1) || null,
        cls: window.__phase6.cls,
        shifts: window.__phase6.shifts,
        longTasks: window.__phase6.longTasks,
        domNodes: document.querySelectorAll('*').length,
        sections,
        productCards: cards.length,
        cardNodes: cards.slice(0, 20).map((card) => card.querySelectorAll('*').length + 1),
        buckets,
      };
    });

    const interactions = {};
    const timeAction = async (name, action) => {
      const started = await page.evaluate(() => performance.now());
      await action();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      interactions[name] = Math.round((await page.evaluate(() => performance.now())) - started);
    };

    if (run === 1) {
      const search = page.locator('input[type="search"]:visible, input[placeholder*="Search" i]:visible').first();
      if (await search.count()) await timeAction('searchTyping', () => search.fill('mala'));
      const wishlist = page.locator('.product-card button[aria-label*="wishlist" i]:visible').first();
      if (await wishlist.count()) await timeAction('wishlistToggle', () => wishlist.click());
      if (profile === 'mobile') {
        const menu = page.locator('button[aria-label="Menu"]').first();
        if (await menu.count()) await timeAction('menuOpen', () => menu.click());
      }
    }

    const events = await page.evaluate(() => window.__phase6.events);
    runs.push({ profile, run, errors, metrics, interactions, events });
    await context.close();
  }
  result.profiles[profile] = {
    runs,
    median: {
      ttfb: median(runs.map((item) => item.metrics.nav.ttfb)),
      fcp: median(runs.map((item) => item.metrics.nav.fcp).filter(Number.isFinite)),
      lcp: median(runs.map((item) => item.metrics.lcp?.startTime).filter(Number.isFinite)),
      cls: median(runs.map((item) => item.metrics.cls)),
      domNodes: median(runs.map((item) => item.metrics.domNodes)),
      longTaskCount: median(runs.map((item) => item.metrics.longTasks.length)),
      longTaskDuration: median(runs.map((item) => item.metrics.longTasks.reduce((sum, task) => sum + task.duration, 0))),
    },
  };
}

await browser.close();
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.profiles).map(([name, data]) => [name, data.median])), null, 2));
