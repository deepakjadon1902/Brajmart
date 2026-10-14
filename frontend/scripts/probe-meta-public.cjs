const { chromium } = require('@playwright/test');
const { JSDOM } = require('jsdom');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

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
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [version, html] of Object.entries(sources)) {
      for (const mobile of [false, true]) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });
        try {
          const page = await context.newPage();
          const blockedPixelRequests = [];
          const errors = [];
          const sdkRequests = [];
          const warnings = [];
          const sdkCalls = [];
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
          console.log(JSON.stringify({ version, viewport: mobile ? 'mobile' : 'desktop', sdkRequests, homepageEvents, allBlockedPixelEvents: blockedPixelRequests, bootstrapQueueLength, finalQueueLength: await page.evaluate(() => window.fbq.queue?.length), sdkCalls, warnings, errors }));
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
