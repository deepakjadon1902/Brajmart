import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
let dom: JSDOM;
let fetchSpy: ReturnType<typeof vi.fn>;
let beaconSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  dom = new JSDOM(html, { url: 'https://www.brajmart.com/thank-you?orderId=999', runScripts: 'outside-only' });
  fetchSpy = vi.fn().mockResolvedValue({ ok: true }); beaconSpy = vi.fn().mockReturnValue(true);
  dom.window.fetch = fetchSpy; dom.window.Response = Response; dom.window.navigator.sendBeacon = beaconSpy;
  dom.window.console.warn = vi.fn();
  dom.window.eval(dom.window.document.querySelector('script')!.textContent!);
  dom.window.__brajmartLoadMarketing();
});
afterEach(() => dom.window.close());
for (const event of ['purchase', 'Purchase', 'PURCHASE']) it(`blocks browser gtag/dataLayer ${event} even with a client verified flag`, () => {
  dom.window.dataLayer.length = 0;
  dom.window.gtag('event', event, { transaction_id: '42', value: 100, verified: true });
  dom.window.dataLayer.push({ event, ecommerce: { transaction_id: '42', value: 100 }, verified: true });
  expect(dom.window.dataLayer).toHaveLength(0);
});
it('blocks the legacy purchase conversion label without blocking other funnel events', () => {
  dom.window.dataLayer.length = 0;
  dom.window.gtag('event', 'conversion', { send_to: 'AW-17517087439/al0OCM6NiK8cEM-V5qBB' });
  expect(dom.window.dataLayer).toHaveLength(0);
  dom.window.gtag('event', 'begin_checkout', { value: 100 });
  dom.window.dataLayer.push({ event: 'add_to_cart' });
  expect(dom.window.dataLayer).toHaveLength(2);
});
it('blocks legacy purchase labels in object and eventModel dataLayer formats', () => {
  dom.window.dataLayer.length = 0;
  dom.window.dataLayer.push({ event: 'conversion', send_to: 'AW-17517087439/al0OCM6NiK8cEM-V5qBB' });
  dom.window.dataLayer.push({ event: 'conversion', eventModel: { send_to: ['AW-17517087439/al0OCM6NiK8cEM-V5qBB'] } });
  expect(dom.window.dataLayer).toHaveLength(0);
});
it('removes preloaded purchase messages while preserving existing funnel messages', () => {
  const early = new JSDOM(html, { url: 'https://www.brajmart.com/', runScripts: 'outside-only' });
  try {
    early.window.dataLayer = [{ event: 'purchase' }, ['event', 'Purchase', {}], { event: 'add_to_cart' }];
    early.window.eval(early.window.document.querySelector('script')!.textContent!);
    expect(early.window.dataLayer.map((entry: { event: string }) => entry.event)).toEqual(['add_to_cart']);
  } finally {
    early.window.close();
  }
});
it('blocks Google purchase fetch, beacon, Request bodies and server-only MP from browsers', async () => {
  await dom.window.fetch('https://region1.google-analytics.com/g/collect?en=purchase');
  dom.window.navigator.sendBeacon('https://www.google-analytics.com/g/collect', 'en=purchase');
  await dom.window.fetch(new Request('https://www.google-analytics.com/g/collect', { method: 'POST', body: 'en=purchase' }));
  await dom.window.fetch('https://www.google-analytics.com/mp/collect', { method: 'POST', body: '{}' });
  await dom.window.fetch('https://www.googleadservices.com/pagead/conversion/17517087439/?label=al0OCM6NiK8cEM-V5qBB');
  expect(fetchSpy).not.toHaveBeenCalled(); expect(beaconSpy).not.toHaveBeenCalled();
  await dom.window.fetch('/api/payments/status/order_Real');
  expect(fetchSpy).toHaveBeenCalledTimes(1);
});
it('keeps the conflicting legacy container disabled by default and removes unguarded noscript tracking', () => {
  const sources = [...dom.window.document.scripts].map((script) => script.src);
  expect(sources.some((url) => url.includes('/gtm.js?id=GTM-PBFHQWC4'))).toBe(false);
  expect(sources.some((url) => url.includes('/gtag/js?id=AW-17517087439'))).toBe(true);
  expect(html).not.toMatch(/ns\.html\?id=GTM-|ev=PageView&noscript/);
});
