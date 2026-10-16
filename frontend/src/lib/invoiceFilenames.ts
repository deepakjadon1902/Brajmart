// Both the manifest and individual response must provide a single safe filename.
export const isInvoiceFilename = (filename: unknown, orderId: string): filename is string => (
  typeof filename === 'string' && filename.length <= 200 && filename.trim() === filename
  && !/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(filename)
  && !filename.startsWith('.')
  && (filename.endsWith(` - Invoice-${orderId}.pdf`) || filename === `BrajMart-Invoice-${orderId}.pdf`)
);
