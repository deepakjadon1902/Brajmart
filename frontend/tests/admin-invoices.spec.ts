import { expect, test, type Page } from '../playwright-fixture';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

const order = {
  _id: '10339', orderId: 10339, customerName: 'Bikram Paul', customerEmail: 'bikram@example.com',
  items: [{ name: 'Tulsi Kanthi Mala Two Round', sku: 'TMK-21', price: 100, quantity: 1 }],
  total: 159, status: 'shipped', paymentMethod: 'UPI', shippingService: 'DTDC', trackingId: 'AWB10339',
  shippingAddress: { fullName: 'Bikram Paul', street: 'Temple Road', city: 'Mathura', state: 'Uttar Pradesh', pincode: '281001', mobile: '9876543210' },
  createdAt: '2026-10-14T08:00:00Z', statusHistory: [],
};
const customerName = (id: string) => id === '10341' ? 'रेखा देवी' : 'Bikram Paul';
const invoiceFilename = (id: string) => `${customerName(id)} - Invoice-${id}.pdf`;
const entries = Array.from({ length: 133 }, (_, i) => ({ orderId: String(10339 + i), filename: invoiceFilename(String(10339 + i)) }));
const pdf = (id: string) => `%PDF-1.4\nTest invoice ${id}\n%%EOF`;
const batchButton = (page: Page) => page.getByRole('button', { name: /Save All Invoices to Folder|Download Invoice Folder/ });

async function enableFolderPicker(page: Page) {
  await page.addInitScript(() => {
    const state = window as any;
    state.invoiceFiles = {};
    state.invoiceFolders = [];
    state.showDirectoryPicker = async () => ({
      name: 'Downloads',
      getDirectoryHandle: async (name: string) => {
        state.invoiceFolders.push(name);
        return {
          name,
          getFileHandle: async (filename: string) => ({
            createWritable: async () => {
              let contents: string;
              return {
                write: async (data: Blob | string) => { contents = typeof data === 'string' ? data : await data.text(); },
                close: async () => { state.invoiceFiles[filename] = contents; },
                abort: async () => {},
              };
            },
          }),
        };
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('brajmart-admin', JSON.stringify({ state: { isAdminAuthenticated: true, adminEmail: 'admin@brajmart.com', token: 'test-admin-token' }, version: 0 }));
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined, writable: true, configurable: true });
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/orders') return route.fulfill({ json: [order] });
    if (url.pathname === '/api/orders/admin/invoices') return route.fulfill({ json: { invoices: entries } });
    const invoiceId = url.pathname.match(/^\/api\/orders\/(\d+)\/invoice$/)?.[1];
    if (invoiceId) return route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf(invoiceId), headers: {
      'Content-Disposition': `attachment; filename="BrajMart-Invoice-${invoiceId}.pdf"; filename*=UTF-8''${encodeURIComponent(invoiceFilename(invoiceId))}`,
    } });
    return route.fulfill({ json: url.pathname === '/api/products' ? [] : {} });
  });
});

test('individual invoice downloads directly as a complete PDF without a print tab', async ({ page }) => {
  await page.goto('/admin/orders');
  const pageCount = page.context().pages().length;
  const downloadEvent = page.waitForEvent('download');
  const requestEvent = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders/10339/invoice');
  await page.getByRole('button', { name: 'Download PDF invoice for order 10339' }).click();
  const [download, request] = await Promise.all([downloadEvent, requestEvent]);
  expect(download.suggestedFilename()).toBe('Bikram Paul - Invoice-10339.pdf');
  expect(new URL(request.url()).searchParams.get('download')).toBe('1');
  expect(request.headers().authorization).toBe('Bearer test-admin-token');
  expect(await download.failure()).toBeNull();
  expect(page.context().pages()).toHaveLength(pageCount);
  await expect(page.getByText('Invoice PDF downloaded')).toBeVisible();
});

test('saves all 133 individual PDFs into one chosen folder, ignoring table filters', async ({ page }) => {
  await enableFolderPicker(page);
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/invoice')) requests.push(request.url()); });
  await page.goto('/admin/orders');
  await page.getByPlaceholder('Search by Order ID or Customer...').fill('no matching customer');
  const manifestRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/orders/admin/invoices');
  await batchButton(page).click();
  const request = await manifestRequest;
  await expect(page.getByRole('status').filter({ hasText: '133 invoice PDFs saved in folder' })).toBeVisible();
  const files = await page.evaluate(() => (window as any).invoiceFiles);
  expect(Object.keys(files)).toHaveLength(133);
  for (const entry of entries) expect(files[entry.filename]).toBe(pdf(entry.orderId));
  expect(await page.evaluate(() => (window as any).invoiceFolders)).toHaveLength(1);
  expect(new URL(request.url()).search).toBe('');
  expect(request.headers().authorization).toBe('Bearer test-admin-token');
  expect(requests.some((url) => url.includes('invoices.zip'))).toBe(false);
  await page.screenshot({ path: 'test-results/admin-invoice-folder-downloads.png', fullPage: true });
});

test('fallback downloads a finalized ZIP with a folder and every PDF', async ({ page }) => {
  await page.goto('/admin/orders');
  const downloadEvent = page.waitForEvent('download');
  await batchButton(page).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('BrajMart-All-Invoices.zip');
  expect(await download.failure()).toBeNull();
  const bytes = await readFile((await download.path())!);
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThan(0);
  expect(bytes.readUInt16LE(end + 10)).toBe(133);
  const files = unzipSync(bytes);
  expect(Object.keys(files)).toHaveLength(133);
  for (const entry of entries) expect(strFromU8(files[`BrajMart-Invoices/${entry.filename}`])).toBe(pdf(entry.orderId));
  await expect(page.getByRole('status').filter({ hasText: 'Extract it to open the invoice folder.' })).toBeVisible();
  await download.saveAs('test-results/complete-invoice-folder.zip');
});

test('truncated or failed PDFs are not saved; order numbers and errors are reported', async ({ page }) => {
  await enableFolderPicker(page);
  await page.route('**/api/orders/admin/invoices', (route) => route.fulfill({ json: { invoices: entries.slice(0, 3) } }));
  await page.route('**/api/orders/10340/invoice?*', (route) => route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nCut off' }));
  await page.route('**/api/orders/10341/invoice?*', (route) => route.fulfill({ status: 503, json: { message: 'Please retry this invoice' } }));
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: '1 of 3 PDFs saved' })).toBeVisible();
  const files = await page.evaluate(() => (window as any).invoiceFiles);
  expect(Object.keys(files).sort()).toEqual(['Bikram Paul - Invoice-10339.pdf', 'Download-Report.txt']);
  expect(files['Download-Report.txt']).toContain('Order 10340: Invoice 10340 is incomplete');
  expect(files['Download-Report.txt']).toContain('Order 10341: Please retry this invoice');
  await expect(batchButton(page)).toBeEnabled();
});

test('stopping a folder download preserves only the PDFs already completed', async ({ page }) => {
  await enableFolderPicker(page);
  await page.route('**/api/orders/*/invoice?*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[3];
    if (id !== '10339') await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.fulfill({ contentType: 'application/pdf', body: pdf(id) }).catch(() => {});
  });
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: '1 of 133 PDFs saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop Download' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Stopped. 1 of 133 PDFs saved' })).toBeVisible();
  const files = await page.evaluate(() => (window as any).invoiceFiles);
  expect(Object.keys(files).sort()).toEqual(['Bikram Paul - Invoice-10339.pdf', 'Download-Report.txt']);
  expect(files['Bikram Paul - Invoice-10339.pdf']).toBe(pdf('10339'));
});

test('manifest errors remain visible and the download can be retried', async ({ page }) => {
  await page.route('**/api/orders/admin/invoices', (route) => route.fulfill({ status: 503, json: { message: 'Database unavailable' } }));
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Database unavailable' })).toBeVisible();
  await expect(batchButton(page)).toBeEnabled();
  await page.unroute('**/api/orders/admin/invoices');
  const downloadEvent = page.waitForEvent('download');
  await batchButton(page).click();
  expect(await (await downloadEvent).failure()).toBeNull();
});

test('cancelling the folder picker makes no invoice requests or downloads', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).showDirectoryPicker = async () => { throw new DOMException('Cancelled', 'AbortError'); };
  });
  let manifests = 0;
  page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/orders/admin/invoices') manifests++; });
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(batchButton(page)).toBeEnabled();
  expect(manifests).toBe(0);
});

test('folder write failure stops the batch and remains visible for retry', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).showDirectoryPicker = async () => ({
      getDirectoryHandle: async () => ({
        getFileHandle: async () => { throw new DOMException('The selected folder cannot be written', 'NotAllowedError'); },
      }),
    });
  });
  let pdfRequests = 0;
  page.on('request', (request) => { if (/\/orders\/\d+\/invoice/.test(request.url())) pdfRequests++; });
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved 0 of 133 invoices. The selected folder cannot be written' })).toBeVisible();
  expect(pdfRequests).toBeLessThanOrEqual(3);
  await expect(batchButton(page)).toBeEnabled();
});

test('empty invoice lists do not download an empty ZIP', async ({ page }) => {
  await page.route('**/api/orders/admin/invoices', (route) => route.fulfill({ json: { invoices: [] } }));
  await page.goto('/admin/orders');
  await batchButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'There are no order invoices' })).toBeVisible();
  await expect(batchButton(page)).toBeEnabled();
});

test('batch invoice button fits a narrow admin viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enableFolderPicker(page);
  await page.goto('/admin/orders');
  const button = batchButton(page);
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
