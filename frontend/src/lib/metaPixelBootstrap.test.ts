import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const pixelId = '1824114108557446';
let dom: JSDOM;
let rawFbq: ReturnType<typeof vi.fn>;
let rawFetch: ReturnType<typeof vi.fn>;
let rawBeacon: ReturnType<typeof vi.fn>;

describe('actual HTML Meta Pixel guards', () => {
  beforeEach(() => {
    dom = new JSDOM(html, { url: 'https://www.brajmart.com/payment-status/order_Fake', runScripts: 'outside-only' });
    const win = dom.window;
    rawFbq = vi.fn();
    rawFetch = vi.fn().mockResolvedValue({ ok: true });
    rawBeacon = vi.fn().mockReturnValue(true);
    win.fbq = rawFbq;
    win.fetch = rawFetch;
    win.Response = Response;
    win.navigator.sendBeacon = rawBeacon;
    win.console.warn = vi.fn();
    win.eval(win.document.querySelector('script')!.textContent!);
    win.__brajmartLoadMarketing();
    rawFbq.mockClear();
  });

  afterEach(() => dom.window.close());

  for (const command of ['track', 'trackCustom']) {
    for (const name of ['Purchase', 'purchase', 'PURCHASE']) {
      it(`blocks direct fbq ${command} ${name} on a forged success URL`, () => {
        dom.window.fbq(command, name, { order_id: 42, value: 199.99 });
        expect(rawFbq).not.toHaveBeenCalled();
      });
    }
  }
  for (const command of ['trackSingle', 'trackSingleCustom']) {
    it(`blocks direct fbq ${command} Purchase`, () => {
      dom.window.fbq(command, pixelId, 'Purchase', { value: 199.99 });
      expect(rawFbq).not.toHaveBeenCalled();
    });
  }
  it('blocks the _fbq alias too', () => {
    dom.window._fbq('track', 'Purchase');
    expect(rawFbq).not.toHaveBeenCalled();
  });
  it('allows legitimate non-purchase events', () => {
    dom.window.fbq('track', 'AddToCart', { value: 199.99 });
    expect(rawFbq).toHaveBeenCalledWith('track', 'AddToCart', { value: 199.99 });
  });
  const purchaseUrl = `https://www.facebook.com/tr?id=${pixelId}&ev=Purchase`;
  it('blocks direct Purchase fetch requests', async () => {
    await dom.window.fetch(purchaseUrl);
    expect(rawFetch).not.toHaveBeenCalled();
  });
  it('blocks Purchase fetch requests supplied as URL objects', async () => {
    await dom.window.fetch(new dom.window.URL(purchaseUrl));
    expect(rawFetch).not.toHaveBeenCalled();
  });
  it('blocks Purchase fetch requests supplied as Request objects', async () => {
    await dom.window.fetch(new Request(purchaseUrl));
    expect(rawFetch).not.toHaveBeenCalled();
  });
  it('preserves legitimate events when the asynchronously loaded SDK installs callMethod', () => {
    const dispatch = vi.fn();
    dom.window.fbq.callMethod = dispatch;
    dom.window.fbq('track', 'AddToCart', { value: 199.99 });
    expect(dispatch).toHaveBeenCalledWith('track', 'AddToCart', { value: 199.99 });
  });
  it('the fbq.push alias also rejects Purchase', () => {
    dom.window.fbq.push = dom.window.fbq.push || rawFbq;
    dom.window.fbq.push('track', 'Purchase', { value: 199.99 });
    expect(rawFbq).not.toHaveBeenCalled();
  });
  it('blocks direct Purchase beacon requests', () => {
    dom.window.navigator.sendBeacon(purchaseUrl, '');
    expect(rawBeacon).not.toHaveBeenCalled();
  });
  it('blocks Purchase POST fetch data when the event is in the body', async () => {
    await dom.window.fetch('https://www.facebook.com/tr/', { method: 'POST', body: new dom.window.URLSearchParams({ id: pixelId, ev: 'Purchase' }) });
    expect(rawFetch).not.toHaveBeenCalled();
  });
  it('blocks Purchase beacon data when the event is in the body', () => {
    dom.window.navigator.sendBeacon('https://www.facebook.com/tr/', `id=${pixelId}&ev=Purchase`);
    expect(rawBeacon).not.toHaveBeenCalled();
  });
  it('blocks Purchase Request bodies without modifying other API requests', async () => {
    await dom.window.fetch(new Request('https://www.facebook.com/tr/', { method: 'POST', body: `id=${pixelId}&ev=Purchase` }));
    expect(rawFetch).not.toHaveBeenCalled();
    await dom.window.fetch('/api/meta/conversions', { method: 'POST', body: '{"eventName":"AddToCart"}' });
    expect(rawFetch).toHaveBeenCalledOnce();
  });
  it('allows legitimate PageView POST data', async () => {
    await dom.window.fetch('https://www.facebook.com/tr/', { method: 'POST', body: `id=${pixelId}&ev=PageView` });
    expect(rawFetch).toHaveBeenCalledOnce();
  });
  it('blocks attempts to re-enable automatic Pixel configuration', () => {
    dom.window.fbq('set', 'autoConfig', true, pixelId);
    expect(rawFbq).not.toHaveBeenCalled();
  });
  it('blocks direct Purchase image source and setAttribute requests', () => {
    const image = dom.window.document.createElement('img');
    image.src = purchaseUrl;
    expect(image.getAttribute('src')).toBeNull();
    image.setAttribute('src', purchaseUrl);
    expect(image.getAttribute('src')).toBeNull();
  });
});
