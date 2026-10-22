import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../playwright-fixture';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const pixelId = '1824114108557446';

test('browser transport guards block Purchase and retain legitimate SDK events', async ({ page }) => {
  const pixelRequests: string[] = [];
  const gatewayRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'brajmart-meta.test' && route.request().isNavigationRequest()) {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (url.hostname === 'connect.facebook.net' && url.pathname.endsWith('fbevents.js')) {
      // Emulate SDK hydration after the inline queue/guard has been installed.
      return route.fulfill({ contentType: 'application/javascript', body: `
        window.__metaDispatched = [];
        window.fbq.callMethod = function () { window.__metaDispatched.push(Array.from(arguments)); };
        window.fbq.queue.splice(0).forEach(function (args) { window.fbq.apply(window, args); });
      ` });
    }
    if (url.hostname.endsWith('facebook.com')) pixelRequests.push(route.request().url());
    if (url.pathname === '/events') gatewayRequests.push(route.request().url());
    // Every external request is intercepted. No tracking or payments reach a service.
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.goto('https://brajmart-meta.test/payment-status/order_Fake?status=paid');
  await page.evaluate(() => window.__brajmartLoadMarketing?.());
  await page.waitForFunction(() => typeof window.fbq?.callMethod === 'function');
  pixelRequests.length = 0;
  await page.evaluate(async (id) => {
    const url = `https://www.facebook.com/tr?id=${id}&ev=Purchase`;
    window.fbq('track', 'Purchase', { value: 199.99 });
    window.fbq('trackCustom', 'Purchase');
    window.fbq('trackSingle', id, 'Purchase');
    window.fbq('trackSingleCustom', id, 'Purchase');
    window._fbq('track', 'Purchase');
    window.fbq.push('track', 'Purchase');
    await fetch(url);
    await fetch(new URL(url));
    await fetch(new Request(url));
    await fetch('https://www.facebook.com/tr/', { method: 'POST', body: new URLSearchParams({ id, ev: 'Purchase' }) });
    await fetch(new Request('https://www.facebook.com/tr/', { method: 'POST', body: `id=${id}&ev=Purchase` }));
    navigator.sendBeacon(url, '');
    navigator.sendBeacon('https://www.facebook.com/tr/', `id=${id}&ev=Purchase`);
    const gateway = 'https://fh-118116076e9a4c2a96a99fbb70bea2a0.ecs.us-west-2.on.aws/events';
    await fetch(gateway, { method: 'POST', body: JSON.stringify({ event_name: 'Purchase' }) });
    navigator.sendBeacon(gateway, new Blob(['gateway payload']));
    const changedGateway = 'https://changed-relay.example/events';
    const purchaseBody = JSON.stringify({ data: [{ event_name: 'Purchase', action_source: 'website' }] });
    await fetch(changedGateway, { method: 'POST', body: purchaseBody });
    await fetch(new Request(changedGateway, { method: 'POST', body: purchaseBody }));
    await fetch(changedGateway, { method: 'POST', body: new Blob([purchaseBody]) });
    const image = new Image();
    image.src = url;
    image.setAttribute('src', url);
    document.body.appendChild(image);
    const script = document.createElement('script');
    script.src = url;
    document.body.appendChild(script);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.send();
    const post = new XMLHttpRequest();
    post.open('POST', 'https://www.facebook.com/tr/');
    post.send(`id=${id}&ev=Purchase`);
    window.fbq('track', 'AddToCart', { value: 199.99 });
    window.fbq('init', '2744712869202681');
    window.fbq('trackSingle', '2744712869202681', 'PageView');
  }, pixelId);
  // Flush browser request scheduling without sending anything to the network.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dispatched = await page.evaluate(() => window.__metaDispatched);
  expect(dispatched.some((args) => args[0] === 'track' && args[1] === 'AddToCart')).toBe(true);
  expect(dispatched.some((args) => args.includes('Purchase'))).toBe(false);
  expect(dispatched.some((args) => args.includes('2744712869202681'))).toBe(false);
  expect(pixelRequests).toEqual([]);
  expect(gatewayRequests).toEqual([]);
});
