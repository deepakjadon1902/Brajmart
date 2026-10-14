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
  it('blocks direct Purchase beacon requests', () => {
    dom.window.navigator.sendBeacon(purchaseUrl, '');
    expect(rawBeacon).not.toHaveBeenCalled();
  });
  it('blocks direct Purchase image source and setAttribute requests', () => {
    const image = dom.window.document.createElement('img');
    image.src = purchaseUrl;
    expect(image.getAttribute('src')).toBeNull();
    image.setAttribute('src', purchaseUrl);
    expect(image.getAttribute('src')).toBeNull();
  });
});
