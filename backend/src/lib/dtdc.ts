type DtdcEnv = 'staging' | 'production';

type CachedToken = {
  value: string;
  expiresAt: number;
};

type DtdcApiError = Error & { status?: number };

let cachedToken: CachedToken | null = null;

const getDtdcEnv = (): DtdcEnv => {
  const value = String(process.env.DTDC_ENV || process.env.DTDC_MODE || 'production').toLowerCase();
  return value === 'staging' || value === 'test' ? 'staging' : 'production';
};

const getDtdcConfig = () => {
  const env = getDtdcEnv();
  const username = process.env.DTDC_USERNAME || '';
  const password = process.env.DTDC_PASSWORD || '';
  const portalUrl = process.env.DTDC_PORTAL_URL || 'https://customer.dtdc.in';
  const publicTrackingUrl = process.env.DTDC_PUBLIC_TRACKING_URL || 'https://www.dtdc.com/track-your-shipment/';
  const tokenTtlMinutes = Number(process.env.DTDC_TOKEN_TTL_MINUTES || 50);
  const defaultAuthBase = env === 'staging'
    ? 'https://dtdcstagingapi.dtdc.com/dtdc-api/api/dtdc/authenticate'
    : 'https://blktracksvc.dtdc.com/dtdc-api/api/dtdc/authenticate';
  const authBase = process.env.DTDC_AUTH_URL || defaultAuthBase;
  const defaultTrackingUrl = env === 'staging'
    ? 'https://dtdcstagingapi.dtdc.com/dtdc-tracking-api/dtdc-api/rest/JSONCnTrk/getTrackDetails'
    : 'https://blktracksvc.dtdc.com/dtdc-tracking-api/dtdc-api/rest/JSONCnTrk/getTrackDetails';
  const trackingUrl = process.env.DTDC_TRACKING_URL || defaultTrackingUrl;
  const pincodeUrl = process.env.DTDC_PINCODE_URL || 'https://smarttrack-ctbsplus.dtdc.com/ratecalapi/PincodeApiCall';

  return { env, username, password, portalUrl, publicTrackingUrl, tokenTtlMinutes, authBase, trackingUrl, pincodeUrl };
};

const readResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const findToken = (data: any): string => {
  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return '';
  const keys = ['token', 'accessToken', 'access_token', 'Token', 'TOKEN', 'jwt', 'key'];
  for (const key of keys) {
    if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  }
  for (const value of Object.values(data)) {
    const nested = findToken(value);
    if (nested) return nested;
  }
  return '';
};

const getAuthToken = async () => {
  const config = getDtdcConfig();
  const hasPlaceholderCredentials = /^your_|^YOUR_/i.test(config.username) || /^your_|^YOUR_/i.test(config.password);
  if (!config.username || !config.password || hasPlaceholderCredentials) {
    throw new Error('DTDC tracking credentials are not configured. Add real DTDC_USERNAME and DTDC_PASSWORD in backend/.env, then restart the backend.');
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const url = `${config.authBase}?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await readResponse(response);
  if (!response.ok) {
    const portalHint = response.status === 401 || response.status === 403
      ? ` Confirm the account has DTDC API access enabled; customer portal credentials for ${config.portalUrl} may not be enough for this tracking API.`
      : '';
    const error = new Error(`DTDC authentication failed (${response.status}).${portalHint}`) as DtdcApiError;
    error.status = response.status;
    throw error;
  }

  const token = findToken(data);
  if (!token) throw new Error('DTDC authentication did not return a token');
  cachedToken = {
    value: token,
    expiresAt: Date.now() + Math.max(5, config.tokenTtlMinutes) * 60_000,
  };
  return token;
};

const getPublicTrackingUrl = (trackingId: string) => {
  const config = getDtdcConfig();
  const url = new URL(config.publicTrackingUrl);
  url.searchParams.set('awb', trackingId);
  url.searchParams.set('trackingId', trackingId);
  url.searchParams.set('shipmentNumber', trackingId);
  return url.toString();
};

const flattenTrackEvents = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(flattenTrackEvents);
  }
  if (typeof value !== 'object') return [];

  const keys = Object.keys(value);
  const hasEventShape = keys.some((key) => /date|time|status|location|activity|scan|remark/i.test(key));
  const childEvents = Object.values(value).flatMap(flattenTrackEvents);
  if (hasEventShape && childEvents.length === 0) return [value];
  return childEvents;
};

const getFirstString = (record: any, names: string[]) => {
  if (!record || typeof record !== 'object') return '';
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const matchesName = (key: string, name: string) => {
    const keyText = normalize(key);
    const nameText = normalize(name);
    if (nameText === 'cod') return keyText.includes('cod') && keyText !== 'code';
    return keyText.includes(nameText);
  };
  const found = Object.entries(record).find(([key, value]) =>
    names.some((name) => matchesName(key, name))
    && value !== null
    && value !== undefined
    && ['string', 'number', 'boolean'].includes(typeof value)
    && String(value).trim()
  );
  return found ? String(found[1]).trim() : '';
};

const toBooleanLike = (record: any): boolean | null => {
  if (typeof record === 'boolean') return record;
  if (typeof record === 'number') return record > 0;
  if (typeof record === 'string') {
    const value = record.trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (['true', 'yes', 'y', '1', 'serviceable', 'available', 'success', 'valid', 'active'].includes(value)) return true;
    if (['false', 'no', 'n', '0', 'not serviceable', 'unserviceable', 'unavailable', 'failed', 'invalid', 'inactive'].includes(value)) return false;
  }
  return null;
};

const findBooleanLike = (record: any): boolean | null => {
  const direct = toBooleanLike(record);
  if (direct !== null) return direct;
  if (!record || typeof record !== 'object') return null;

  for (const [key, value] of Object.entries(record)) {
    if (/service|servicable|available|delivery|deliverable|ecom|prepaid|cod|pickup|oda/i.test(key)) {
      const keyed = toBooleanLike(value);
      if (keyed !== null) return keyed;
    }
  }
  for (const value of Object.values(record)) {
    const nested = findBooleanLike(value);
    if (nested !== null) return nested;
  }
  return null;
};

const hasFailureSignal = (record: any): boolean => {
  if (!record || typeof record !== 'object') {
    const value = String(record || '').toLowerCase();
    return /not service|non[- ]?service|unserviceable|unavailable|invalid pincode|no data|failed/.test(value);
  }

  for (const [key, value] of Object.entries(record)) {
    const keyText = key.toLowerCase();
    const boolValue = toBooleanLike(value);
    if (/error|invalid|failed|failure|non.*service|not.*service|unservice/i.test(keyText) && boolValue === true) return true;
    if (/service|servicable|available|delivery|deliverable|ecom/i.test(keyText) && boolValue === false) return true;
    if (hasFailureSignal(value)) return true;
  }
  return false;
};

const collectPincodeDetails = (record: any): string[] => {
  if (!record || typeof record !== 'object') return [];
  const details = new Set<string>();
  const addBranch = (label: string, rows: any) => {
    if (!Array.isArray(rows) || !rows[0]) return;
    const branch = rows[0];
    const code = getFirstString(branch, ['code']);
    const name = getFirstString(branch, ['br name', 'fr name']);
    if (code || name) details.add(`${label}: ${[code, name].filter(Boolean).join(' - ')}`);
  };

  addBranch('Origin branch', record.SERV_ORG_BR);
  addBranch('Destination branch', record.SERV_BR);

  const service = getDtdcServiceResponse(record);
  if (service) {
    const b2c = toBooleanLike(service.b2C_SERVICEABLE);
    const cod = toBooleanLike(service.COD_Serviceable);
    const parts = [
      b2c === null ? null : `B2C delivery ${b2c ? 'available' : 'not available'}`,
      cod === null ? null : `COD ${cod ? 'available' : 'not available'}`,
    ].filter(Boolean);
    if (parts.length) details.add(parts.join(' | '));
  }

  return Array.from(details).slice(0, 3);
};

const getDtdcZipcodeResponse = (record: any) => {
  if (!record || typeof record !== 'object') return null;
  const rows = Array.isArray(record.ZIPCODE_RESP) ? record.ZIPCODE_RESP : [];
  return rows.find((row: any) => row && typeof row === 'object') || null;
};

const getDtdcServiceResponse = (record: any) => {
  if (!record || typeof record !== 'object') return null;
  const rows = Array.isArray(record.SERV_LIST) ? record.SERV_LIST : [];
  return rows.find((row: any) => row && typeof row === 'object') || null;
};

const normalizeTrackingResponse = (raw: any, trackingId: string) => {
  const events = flattenTrackEvents(raw)
    .map((event) => ({
      status: getFirstString(event, ['status', 'activity', 'event', 'scan', 'remark']) || 'Shipment update',
      location: getFirstString(event, ['location', 'place', 'city', 'branch']),
      date: getFirstString(event, ['date']),
      time: getFirstString(event, ['time']),
      remarks: getFirstString(event, ['remark', 'description', 'message']),
    }))
    .filter((event) => event.status || event.location || event.date || event.time || event.remarks);

  return {
    carrier: 'DTDC',
    trackingId,
    currentStatus: events[0]?.status || getFirstString(raw, ['status']) || 'Tracking available',
    lastLocation: events[0]?.location || getFirstString(raw, ['location', 'city']),
    events,
    raw,
  };
};

export const trackDtdcShipment = async (params: {
  trackingId: string;
  trkType?: 'cnno' | 'reference';
  addtnlDtl?: 'Y' | 'N';
}) => {
  const trackingId = String(params.trackingId || '').trim();
  if (!trackingId) throw new Error('Tracking ID is required');

  let token = '';
  try {
    token = await getAuthToken();
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      return {
        carrier: 'DTDC',
        trackingId,
        currentStatus: 'AWB saved for tracking',
        lastLocation: '',
        events: [],
        trackingPortalUrl: getPublicTrackingUrl(trackingId),
        raw: { message: err.message, status: err.status },
      };
    }
    throw err;
  }
  const config = getDtdcConfig();
  const response = await fetch(config.trackingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': token,
    },
    body: JSON.stringify({
      trkType: params.trkType || 'cnno',
      strcnno: trackingId,
      addtnlDtl: params.addtnlDtl || 'Y',
    }),
  });
  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(`DTDC tracking failed (${response.status})`);
  }
  return normalizeTrackingResponse(data, trackingId);
};

export const checkDtdcPincode = async (params: {
  orgPincode?: string;
  desPincode: string;
}) => {
  const orgPincode = String(params.orgPincode || process.env.DTDC_ORIGIN_PINCODE || '').trim();
  const desPincode = String(params.desPincode || '').trim();
  if (!/^\d{6}$/.test(orgPincode) || !/^\d{6}$/.test(desPincode)) {
    throw new Error('Origin and destination pincodes must be 6 digits');
  }

  const config = getDtdcConfig();
  const response = await fetch(config.pincodeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgPincode, desPincode }),
  });
  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(`DTDC pincode check failed (${response.status})`);
  }
  const zipcodeResponse = getDtdcZipcodeResponse(data);
  const serviceResponse = getDtdcServiceResponse(data);
  const servFlag = toBooleanLike(zipcodeResponse?.SERVFLAG);
  const b2cServiceable = toBooleanLike(serviceResponse?.b2C_SERVICEABLE);
  const explicitServiceability = servFlag ?? b2cServiceable ?? findBooleanLike(data);
  const failed = hasFailureSignal(data);
  const detailLines = collectPincodeDetails(data);
  const serviceable = explicitServiceability ?? !failed;
  const destination = [zipcodeResponse?.DESTCITY, zipcodeResponse?.DESTSTATE].filter(Boolean).join(', ');
  const cod = toBooleanLike(zipcodeResponse?.SERV_COD ?? serviceResponse?.COD_Serviceable);
  const message = getFirstString(zipcodeResponse, ['message', 'status', 'remark', 'description'])
    || detailLines.join(' | ')
    || (serviceable ? 'DTDC delivery appears available' : 'DTDC delivery needs review');
  return {
    carrier: 'DTDC',
    orgPincode,
    desPincode,
    serviceable,
    codAvailable: cod === null ? false : cod,
    message: [
      destination || null,
      serviceable ? 'Delivery available' : 'Delivery needs review',
      cod === null ? null : `COD ${cod ? 'available' : 'not available'}`,
      message && message.toLowerCase() !== 'success' ? message : null,
    ].filter(Boolean).join(' | '),
    details: detailLines,
    raw: data,
  };
};
