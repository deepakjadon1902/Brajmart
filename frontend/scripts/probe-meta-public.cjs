const { chromium } = require('@playwright/test');
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');

// Only public JS/HTML is downloaded. Browser transport is intercepted before
// navigation, so synthetic events cannot reach Meta, Google or the store API.
const download = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Public asset returned HTTP ${response.status}: ${url}`);
  return response.text();
};
const bootstrap = (html) => {
  const document = new JSDOM(html).window.document;
  const script = [...document.querySelectorAll('script')].find((element) => element.textContent.includes('__brajmartLoadMarketing'));
  if (!script) throw new Error('Meta bootstrap not found');
  return '<!doctype html><html><head><script>' + script.textContent + '</script></head><body><button>Isolated audit</button></body></html>';
};

(async () => {
  const [deployedHtml, sdk, config, gtm] = await Promise.all([
    download('https://www.brajmart.com/'),
    download('https://connect.facebook.net/en_US/fbevents.js'),
    download('https://connect.facebook.net/signals/config/1824114108557446'),
    download('https://www.googletagmanager.com/gtm.js?id=GTM-PBFHQWC4'),
  ]);
  const sources = { deployed: bootstrap(deployedHtml), local: bootstrap(readFileSync(resolve(__dirname, '../index.html'), 'utf8')) };
  const failures = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [version, html] of Object.entries(sources)) {
      if (process.argv.includes('--local-only') && version !== 'local') continue;
      for (const mobile of [false, true]) {
        // Meta suppresses HeadlessChrome events. Use a normal browser UA while
        // retaining full network isolation to exercise the shopper SDK path.
        const userAgent = `Mozilla/5.0 (${mobile ? 'Linux; Android 13; Pixel 7' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()}${mobile ? ' Mobile' : ''} Safari/537.36`;
        const context = await browser.newContext({ serviceWorkers: 'block', userAgent, viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });
        try {
          const page = await context.newPage();
          const blockedPixelRequests = [];
          const errors = [];
          const sdkRequests = [];
          const warnings = [];
          const sdkCalls = [];
          const otherRequests = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => { if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text().slice(0, 240)); });
          await page.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (request.isNavigationRequest() && url.hostname === 'www.brajmart.com') return route.fulfill({ contentType: 'text/html', body: html });
            if (url.hostname === 'connect.facebook.net' && url.pathname.endsWith('/fbevents.js')) {
              sdkRequests.push('SDK');
              return route.fulfill({ contentType: 'application/javascript', body: sdk });
            }
            if (url.hostname === 'connect.facebook.net' && url.pathname.includes('/signals/config/1824114108557446')) {
              sdkRequests.push('Pixel config');
              return route.fulfill({ contentType: 'application/javascript', body: config });
            }
            if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtm.js') {
              return route.fulfill({ contentType: 'application/javascript', body: gtm });
            }
            if (url.hostname.endsWith('facebook.com') && url.pathname.replace(/\/+$/, '') === '/tr') {
              const parameters = new URLSearchParams(url.search);
              const body = new URLSearchParams(request.postData() || '');
              blockedPixelRequests.push({ event: parameters.get('ev') || body.get('ev'), pixel: parameters.get('id') || body.get('id') });
            }
            const body = request.postData() || '';
            const names = [];
            try {
              const collect = (value) => {
                if (!value || typeof value !== 'object') return;
                for (const [key, nested] of Object.entries(value)) {
                  if (['event_name', 'eventName', 'ev'].includes(key)) names.push(nested);
                  else if (nested && typeof nested === 'object') collect(nested);
                }
              };
              collect(JSON.parse(body));
            } catch {}
            otherRequests.push({ host: url.hostname, path: url.pathname, type: request.resourceType(), eventNames: names, containsPurchase: /purchase/i.test(body) });
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
          });
          await page.goto('https://www.brajmart.com/', { waitUntil: 'domcontentloaded' });
          await page.evaluate(() => window.__brajmartLoadMarketing());
          await page.waitForFunction(() => typeof window.fbq?.callMethod === 'function', undefined, { timeout: 15_000 });
          await page.waitForTimeout(1_500);
          const homepageEvents = [...blockedPixelRequests];
          const bootstrapQueueLength = await page.evaluate(() => window.fbq.queue?.length);
          await page.exposeFunction('__auditSdkCall', (args) => sdkCalls.push(args));
          await page.evaluate(() => {
            const dispatch = window.fbq.callMethod;
            window.fbq.callMethod = function (...args) { window.__auditSdkCall(args); return dispatch.apply(this, args); };
          });
          await page.evaluate(() => {
            window.fbq('track', 'AddToCart', { value: 199.99, currency: 'INR' });
            window.fbq('track', 'Purchase', { value: 199.99, currency: 'INR' });
            window.dataLayer.push({ event: 'purchase', ecommerce: { transaction_id: 'ISOLATED_FAKE', value: 199.99, currency: 'INR' } });
          });
          await page.waitForTimeout(1_000);
          const finalQueueLength = await page.evaluate(() => window.fbq.queue?.length);
          console.log(JSON.stringify({ version, viewport: mobile ? 'mobile' : 'desktop', sdkRequests, homepageEvents, interceptedPixelEvents: blockedPixelRequests, bootstrapQueueLength, finalQueueLength, sdkCalls, otherRequests, warnings, errors }));
          try {
            assert.deepEqual(errors, [], 'SDK must hydrate without errors');
            assert.equal(finalQueueLength, 0, 'SDK must drain the bootstrap queue');
            assert.equal(homepageEvents.filter((event) => event.event === 'PageView').length, 1, 'homepage must emit one PageView');
            assert.equal(blockedPixelRequests.filter((event) => event.event === 'AddToCart').length, 1, 'legitimate AddToCart must reach the intercepted transport');
            assert.ok(blockedPixelRequests.every((event) => event.pixel === '1824114108557446' && event.event?.toLowerCase() !== 'purchase'), 'Purchase and foreign pixels must never reach transport');
            assert.ok(!otherRequests.some((request) => request.path === '/gtm.js'), 'legacy GTM must stay disabled');
            assert.ok(!otherRequests.some((request) => request.containsPurchase), 'automatic gateway requests must not bypass the Purchase guard');
          } catch (error) {
            failures.push(`${version}/${mobile ? 'mobile' : 'desktop'}: ${error.message}`);
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], 'Meta SDK audit failures');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
