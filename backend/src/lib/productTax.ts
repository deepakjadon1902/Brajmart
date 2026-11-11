export type ProductTax = { hsnCode: string | null; unit: string | null; gstRate: number | null };

// A missing rate is deliberately different from an explicitly configured 0%.
export const normalizeProductTaxFields = (data: any) => {
  if (data.hsnCode !== undefined) {
    if (data.hsnCode !== null && typeof data.hsnCode !== 'string') return 'HSN must be 4, 6 or 8 digits';
    const hsn = String(data.hsnCode ?? '').trim();
    if (hsn && !/^(\d{4}|\d{6}|\d{8})$/.test(hsn)) return 'HSN must be 4, 6 or 8 digits';
    data.hsnCode = hsn || null;
  }
  if (data.unit !== undefined) {
    if (data.unit !== null && typeof data.unit !== 'string') return 'Unit must be a short label such as PCS, SET or KG';
    const unit = String(data.unit ?? '').trim().toUpperCase();
    if (unit && !/^[A-Z][A-Z0-9 ./-]{0,15}$/.test(unit)) return 'Unit must be a short label such as PCS, SET or KG';
    data.unit = unit || null;
  }
  if (data.gstRate !== undefined) {
    if (data.gstRate === null || data.gstRate === '') data.gstRate = null;
    else {
      if (!['string', 'number'].includes(typeof data.gstRate) || !/^\d+(\.\d{1,2})?$/.test(String(data.gstRate).trim())) return 'GST rate must be between 0 and 100 with up to 2 decimal places';
      const rate = Number(data.gstRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'GST rate must be between 0 and 100 with up to 2 decimal places';
      data.gstRate = rate;
    }
  }
  return null;
};

export const productTaxFromRow = (row: any): ProductTax => ({
  hsnCode: row.hsn_code == null ? null : String(row.hsn_code).trim() || null,
  unit: row.unit == null ? null : String(row.unit).trim() || null,
  gstRate: row.gst_rate == null ? null : Number(row.gst_rate),
});

// Allocate integer paise by largest remainder so every line adds up exactly.
export const allocatePaise = (amount: number, weights: number[]) => {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > total || weights.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid discount allocation');
  if (!total) return weights.map(() => 0);
  const shares = weights.map((weight, index) => {
    const product = BigInt(amount) * BigInt(weight);
    return { index, amount: Number(product / BigInt(total)), remainder: product % BigInt(total) };
  });
  let remaining = amount - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (remaining-- <= 0) break;
    share.amount++;
  }
  return shares.map((share) => share.amount);
};

const stateAliases: Record<string, string> = {
  '01': 'Jammu and Kashmir|JK', '02': 'Himachal Pradesh|HP', '03': 'Punjab|PB', '04': 'Chandigarh|CH',
  '05': 'Uttarakhand|Uttaranchal|UK|UT', '06': 'Haryana|HR', '07': 'Delhi|New Delhi|DL|NCT of Delhi',
  '08': 'Rajasthan|RJ', '09': 'Uttar Pradesh|UP|उत्तर प्रदेश', '10': 'Bihar|BR', '11': 'Sikkim|SK',
  '12': 'Arunachal Pradesh|AR', '13': 'Nagaland|NL', '14': 'Manipur|MN', '15': 'Mizoram|MZ',
  '16': 'Tripura|TR', '17': 'Meghalaya|ML', '18': 'Assam|AS', '19': 'West Bengal|WB',
  '20': 'Jharkhand|JH', '21': 'Odisha|Orissa|OD|OR', '22': 'Chhattisgarh|CT|CG',
  '23': 'Madhya Pradesh|MP', '24': 'Gujarat|GJ', '26': 'Dadra and Nagar Haveli and Daman and Diu|Dadra and Nagar Haveli|Daman and Diu|DN|DD',
  '27': 'Maharashtra|MH', '29': 'Karnataka|KA', '30': 'Goa|GA', '31': 'Lakshadweep|LD',
  '32': 'Kerala|KL', '33': 'Tamil Nadu|TN', '34': 'Puducherry|Pondicherry|PY',
  '35': 'Andaman and Nicobar Islands|Andaman & Nicobar Islands|AN', '36': 'Telangana|TS|TG',
  '37': 'Andhra Pradesh|AP', '38': 'Ladakh|LA',
};
const stateKey = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, '');
export const invoiceStateCode = (value: unknown) => {
  const key = stateKey(value);
  return Object.entries(stateAliases).find(([code, aliases]) => key === code || key === String(Number(code)) || aliases.split('|').some((alias) => stateKey(alias) === key))?.[0] || null;
};
