import { strToU8, zipSync } from 'fflate';
import { fetchOrderInvoice, type InvoiceDownloadEntry } from './api';
import { isInvoiceFilename } from './invoiceFilenames';

export type InvoiceDownloadProgress = { total: number; completed: number; saved: number; failed: number };
export type InvoiceDownloadFailure = { orderId: string; message: string };
export type InvoiceDownloadResult = InvoiceDownloadProgress & { failures: InvoiceDownloadFailure[]; cancelled: boolean };
export interface InvoiceDirectory {
  name: string;
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<InvoiceDirectory>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
  }>;
}
type DirectoryPicker = (options: { id: string; mode: 'readwrite'; startIn: 'downloads' }) => Promise<InvoiceDirectory>;

export const getInvoiceDirectoryPicker = (): DirectoryPicker | undefined => {
  if (typeof window === 'undefined') return undefined;
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return picker?.bind(window);
};

export const invoiceFolderName = () => {
  const stamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(/[^0-9]/g, '');
  return `BrajMart-Invoices-${stamp}-${crypto.randomUUID().slice(0, 4)}`;
};

const downloadInvoices = async (
  entries: InvoiceDownloadEntry[],
  save: (entry: InvoiceDownloadEntry, pdf: Blob) => Promise<void>,
  signal: AbortSignal,
  onProgress: (progress: InvoiceDownloadProgress) => void,
): Promise<InvoiceDownloadResult> => {
  // Ignore table filters and pagination; each manifest entry gets one short request.
  const unique = [...new Map(entries.map((entry) => [entry.orderId, entry])).values()];
  for (const entry of unique) {
    if (!/^\d+$/.test(entry.orderId) || !isInvoiceFilename(entry.filename, entry.orderId)) throw new Error('Invalid invoice filename received');
  }
  const progress = { total: unique.length, completed: 0, saved: 0, failed: 0 };
  const failures: InvoiceDownloadFailure[] = [];
  let next = 0;
  let writeFailed = false;
  onProgress({ ...progress });
  const worker = async () => {
    while (!signal.aborted && !writeFailed && next < unique.length) {
      const entry = unique[next++];
      let pdf: Blob;
      try {
        pdf = await fetchOrderInvoice(entry.orderId, { download: true, signal });
      } catch (error) {
        if (signal.aborted) return;
        failures.push({ orderId: entry.orderId, message: error instanceof Error ? error.message : 'Download failed' });
        progress.failed++; progress.completed++;
        onProgress({ ...progress });
        continue;
      }
      if (signal.aborted || writeFailed) return;
      // A folder write failure stops the export; avoid silently losing more files.
      try { await save(entry, pdf); }
      catch (error) { writeFailed = true; throw error; }
      progress.saved++; progress.completed++;
      onProgress({ ...progress });
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: Math.min(3, unique.length) }, worker));
  const failedWorker = workers.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failedWorker) throw new Error(`Saved ${progress.saved} of ${progress.total} invoices. ${failedWorker.reason instanceof Error ? failedWorker.reason.message : 'The folder could not be written.'}`);
  return { ...progress, failures, cancelled: signal.aborted };
};

const report = (result: InvoiceDownloadResult) => [
  `Saved ${result.saved} of ${result.total} invoice PDFs.`,
  ...result.failures.map((failure) => `Order ${failure.orderId}: ${failure.message}`),
  ...(result.cancelled ? ['Download stopped. Already saved PDFs are complete and can be opened.'] : []),
].join('\r\n');

const writeFile = async (directory: InvoiceDirectory, name: string, data: Blob | string) => {
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try { await writable.write(data); await writable.close(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
};

export const saveInvoicesToFolder = async (entries: InvoiceDownloadEntry[], directory: InvoiceDirectory, signal: AbortSignal, onProgress: (progress: InvoiceDownloadProgress) => void) => {
  const result = await downloadInvoices(entries, (entry, pdf) => writeFile(directory, entry.filename, pdf), signal, onProgress);
  if (result.failed || result.cancelled) await writeFile(directory, 'Download-Report.txt', report(result));
  return result;
};

export const downloadInvoiceFolderZip = async (entries: InvoiceDownloadEntry[], signal: AbortSignal, onProgress: (progress: InvoiceDownloadProgress) => void) => {
  const files: Record<string, Uint8Array> = {};
  const result = await downloadInvoices(entries, async (entry, pdf) => {
    files[`BrajMart-Invoices/${entry.filename}`] = new Uint8Array(await pdf.arrayBuffer());
  }, signal, onProgress);
  if (result.cancelled) return { result, blob: null };
  if (!result.saved) throw new Error(result.failures[0]?.message || 'There are no invoices to download');
  if (result.failed) files['BrajMart-Invoices/Download-Report.txt'] = strToU8(report(result));
  // PDF streams are already compressed. Build the complete ZIP in the browser
  // after every PDF has arrived, so a proxy timeout cannot cut off its index.
  const bytes = zipSync(files, { level: 0 });
  return { result, blob: new Blob([new Uint8Array(bytes).buffer], { type: 'application/zip' }) };
};
