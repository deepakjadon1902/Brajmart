import { dbExecute, dbQuery } from './db';
import { boolFromDb } from './dbHelpers';
import type { PricedOrderItem } from './orderPricing';

const readJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const toBooleanLike = (value: any): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'serviceable', 'available', 'active'].includes(text)) return true;
    if (['false', 'no', 'n', '0', 'not serviceable', 'unserviceable', 'unavailable', 'inactive', 'nsz'].includes(text)) return false;
  }
  return null;
};

const getDeliveryPartnerConfig = () => {
  const provider = String(process.env.DELIVERY_PARTNER_PROVIDER || 'manual').trim().toLowerCase();
  const env = String(process.env.DELHIVERY_ENV || process.env.DELIVERY_PARTNER_ENV || 'production').trim().toLowerCase();
  const partnerName = String(process.env.DELIVERY_PARTNER_NAME || (provider === 'delhivery' ? 'Delhivery' : 'Delivery Service Partner')).trim();
  const token = String(process.env.DELHIVERY_API_TOKEN || process.env.DELHIVERY_TOKEN || process.env.DELIVERY_PARTNER_API_TOKEN || '').trim();
  const defaultDelhiveryUrl = env === 'staging'
    ? 'https://staging-express.delhivery.com/c/api/pin-codes/json/'
    : 'https://track.delhivery.com/c/api/pin-codes/json/';
  const pincodeUrl = String(process.env.DELHIVERY_PINCODE_URL || process.env.DELIVERY_PINCODE_URL || defaultDelhiveryUrl).trim();
  const defaultDelhiveryTrackingUrl = env === 'staging'
    ? 'https://staging-express.delhivery.com/api/v1/packages/json/'
    : 'https://track.delhivery.com/api/v1/packages/json/';
  const trackingUrl = String(process.env.DELHIVERY_TRACKING_URL || process.env.DELIVERY_TRACKING_URL || defaultDelhiveryTrackingUrl).trim();
  const publicTrackingUrl = String(process.env.DELHIVERY_PUBLIC_TRACKING_URL || process.env.DELIVERY_PUBLIC_TRACKING_URL || 'https://www.delhivery.com/track/package/').trim();
  const fallbackMode = String(process.env.DELIVERY_SERVICEABILITY_FALLBACK || 'database').trim().toLowerCase();
  const defaultDelivery = String(process.env.DELIVERY_DEFAULT_SERVICEABLE || 'true').trim().toLowerCase() !== 'false';
  const defaultCod = String(process.env.DELIVERY_DEFAULT_COD_ENABLED || 'true').trim().toLowerCase() !== 'false';
  return { provider, env, partnerName, token, pincodeUrl, trackingUrl, publicTrackingUrl, fallbackMode, defaultDelivery, defaultCod };
};

const findFirstObjectWithPincode = (value: any, pincode: string): any | null => {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstObjectWithPincode(item, pincode);
      if (found) return found;
    }
    return null;
  }
  const values = Object.values(value).map((v) => String(v ?? '').trim());
  if (values.includes(pincode)) return value;
  for (const nested of Object.values(value)) {
    const found = findFirstObjectWithPincode(nested, pincode);
    if (found) return found;
  }
  return null;
};

const getKeyValue = (record: any, names: RegExp[]) => {
  if (!record || typeof record !== 'object') return undefined;
  const entry = Object.entries(record).find(([key]) => names.some((pattern) => pattern.test(key)));
  return entry?.[1];
};

const getExactKeyValue = (record: any, names: string[]) => {
  if (!record || typeof record !== 'object') return undefined;
  const normalizedNames = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  const entry = Object.entries(record).find(([key]) =>
    normalizedNames.includes(key.toLowerCase().replace(/[^a-z0-9]+/g, ''))
  );
  return entry?.[1];
};

const getFirstString = (record: any, names: RegExp[]) => {
  if (!record || typeof record !== 'object') return '';
  const found = Object.entries(record).find(([key, value]) =>
    names.some((pattern) => pattern.test(key))
    && value !== null
    && value !== undefined
    && ['string', 'number', 'boolean'].includes(typeof value)
    && String(value).trim()
  );
  return found ? String(found[1]).trim() : '';
};

const flattenTrackingEvents = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenTrackingEvents);
  if (typeof value !== 'object') return [];
  const hasEventShape = Object.keys(value).some((key) => /scan|status|location|date|time|remark|instruction/i.test(key));
  const children = Object.values(value).flatMap(flattenTrackingEvents);
  if (hasEventShape && children.length === 0) return [value];
  return children;
};

const getDelhiveryTrackingPortalUrl = (trackingId: string) => {
  const config = getDeliveryPartnerConfig();
  const base = config.publicTrackingUrl.endsWith('/') ? config.publicTrackingUrl : `${config.publicTrackingUrl}/`;
  return `${base}${encodeURIComponent(trackingId)}`;
};

const checkDelhiveryPincode = async (desPincode: string) => {
  const config = getDeliveryPartnerConfig();
  if (!config.token) throw new Error('Delhivery API token is not configured');
  const url = new URL(config.pincodeUrl);
  url.searchParams.set('filter_codes', desPincode);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Token ${config.token}`,
      Accept: 'application/json',
    },
  });
  const raw = await readJsonResponse(response);
  if (!response.ok) throw new Error(`Delhivery pincode check failed (${response.status})`);

  const record = findFirstObjectWithPincode(raw, desPincode);
  const prePaid = toBooleanLike(
    getExactKeyValue(record, ['pre_paid', 'prepaid', 'pre-paid'])
    ?? getKeyValue(record, [/pre.*paid/i, /^delivery$/i, /^pickup$/i])
  );
  const cod = toBooleanLike(
    getExactKeyValue(record, ['cod', 'cash'])
    ?? getKeyValue(record, [/^cod$/i, /^cash$/i, /cash.*on.*delivery/i])
  );
  const paymentType = String(getExactKeyValue(record, ['payment_type', 'paymentType']) || getKeyValue(record, [/payment.*type/i]) || '').toLowerCase();
  const nsz = String(raw || '').toLowerCase().includes('nsz');
  const serviceable = prePaid ?? Boolean(record && !nsz);
  const codAvailable = cod ?? paymentType.includes('cod');
  const destination = [
    getExactKeyValue(record, ['city', 'district']),
    getExactKeyValue(record, ['state_code', 'state']),
  ].filter(Boolean).join(', ');

  return {
    carrier: config.partnerName || 'Delhivery',
    pincode: desPincode,
    desPincode,
    serviceable,
    codAvailable: Boolean(serviceable && codAvailable),
    manualReview: false,
    message: [
      destination || null,
      serviceable ? 'Delivery available' : 'Delivery not serviceable',
      serviceable && codAvailable ? 'COD available' : 'COD not available',
    ].filter(Boolean).join(' | '),
    details: destination ? [destination] : [],
    raw,
  };
};

const normalizeDelhiveryTrackingResponse = (raw: any, trackingId: string) => {
  const shipment = Array.isArray(raw?.ShipmentData) ? raw.ShipmentData[0]?.Shipment : raw?.ShipmentData?.Shipment || raw?.Shipment || raw;
  const scans = shipment?.Scans || raw?.Scans || raw;
  const events = flattenTrackingEvents(scans)
    .map((event) => {
      const scanDetail = event?.ScanDetail || event;
      return {
        status: getFirstString(scanDetail, [/scan$/i, /status/i, /instruction/i]) || 'Shipment update',
        location: getFirstString(scanDetail, [/scannedlocation/i, /location/i, /city/i, /branch/i]),
        date: getFirstString(scanDetail, [/scandate/i, /date/i]),
        time: getFirstString(scanDetail, [/time/i]),
        remarks: getFirstString(scanDetail, [/instructions?/i, /remark/i, /message/i]),
      };
    })
    .filter((event) => event.status || event.location || event.date || event.time || event.remarks);

  return {
    carrier: getDeliveryPartnerConfig().partnerName || 'Delhivery',
    trackingId,
    currentStatus: getFirstString(shipment, [/status/i, /scan/i]) || events[0]?.status || 'Tracking available',
    lastLocation: getFirstString(shipment, [/destination/i, /location/i, /city/i]) || events[0]?.location || '',
    events,
    trackingPortalUrl: getDelhiveryTrackingPortalUrl(trackingId),
    raw,
  };
};

export const trackDeliveryServiceShipment = async (params: { trackingId: string }) => {
  const trackingId = String(params.trackingId || '').trim();
  if (!trackingId) throw new Error('Tracking ID is required');
  const config = getDeliveryPartnerConfig();
  if (config.provider !== 'delhivery') {
    return {
      carrier: config.partnerName || 'Delivery Service Partner',
      trackingId,
      currentStatus: 'Tracking ID saved',
      lastLocation: '',
      events: [],
      raw: { message: 'Live tracking is configured for Delhivery only.' },
    };
  }
  if (!config.token) throw new Error('Delhivery API token is not configured');

  const url = new URL(config.trackingUrl);
  url.searchParams.set('waybill', trackingId);
  url.searchParams.set('ref_ids', '');
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${config.token}`,
      Accept: 'application/json',
    },
  });
  const raw = await readJsonResponse(response);
  if (!response.ok) throw new Error(`Delhivery tracking failed (${response.status})`);
  return normalizeDelhiveryTrackingResponse(raw, trackingId);
};

export const ensureDeliveryServiceSchema = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS delivery_pincode_rules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      pincode VARCHAR(6) NOT NULL,
      delivery_enabled TINYINT(1) NOT NULL DEFAULT 1,
      cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
      partner_name VARCHAR(120) NOT NULL DEFAULT 'Delivery Service Partner',
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_delivery_pincode_rules_pincode (pincode),
      KEY idx_delivery_pincode_rules_cod (cod_enabled, delivery_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

export const checkDeliveryServicePincode = async (params: { desPincode: string }) => {
  const desPincode = String(params.desPincode || '').replace(/\D/g, '').trim();
  if (!/^\d{6}$/.test(desPincode)) throw new Error('Destination pincode must be 6 digits');

  const config = getDeliveryPartnerConfig();
  if (config.provider === 'delhivery') {
    try {
      return await checkDelhiveryPincode(desPincode);
    } catch (err) {
      if (config.fallbackMode === 'none') throw err;
    }
  }

  await ensureDeliveryServiceSchema();
  const rows = await dbQuery<any>(
    'SELECT * FROM delivery_pincode_rules WHERE pincode = ? LIMIT 1',
    [desPincode]
  );
  const totalRows = await dbQuery<any>('SELECT COUNT(*) AS total FROM delivery_pincode_rules');
  const hasRules = Number(totalRows?.[0]?.total || 0) > 0;
  const rule = rows?.[0] || null;

  const serviceable = rule ? boolFromDb(rule.delivery_enabled) : hasRules ? false : config.defaultDelivery;
  const codAvailable = rule ? serviceable && boolFromDb(rule.cod_enabled) : hasRules ? false : config.defaultCod;
  const partner = String(rule?.partner_name || config.partnerName || 'Delivery Service Partner');

  return {
    carrier: partner,
    pincode: desPincode,
    desPincode,
    serviceable,
    codAvailable,
    manualReview: !rule && !hasRules && config.provider !== 'manual',
    message: serviceable
      ? codAvailable
        ? `${partner} delivery and COD available for ${desPincode}`
        : `${partner} delivery available, COD not available for ${desPincode}`
      : `${partner} delivery is not serviceable for ${desPincode}`,
    details: rule?.note ? [String(rule.note)] : [],
  };
};

export const getCodEligibilityForItems = async (items: PricedOrderItem[]) => {
  const ids = Array.from(new Set((items || []).map((item) => String(item.productId || '').trim()).filter(Boolean)));
  if (!ids.length) return { eligible: false, message: 'Cart is empty', blockedItems: [] as string[] };

  const rows = await dbQuery<any>(
    `SELECT p.id, p.name, p.cod_enabled AS product_cod_enabled, c.cod_enabled AS category_cod_enabled
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  const byId = new Map<string, any>((rows || []).map((row: any) => [String(row.id), row]));
  const blockedItems: string[] = [];

  for (const item of items || []) {
    const row = byId.get(String(item.productId));
    const productOverride = row?.product_cod_enabled;
    const productAllowed = productOverride === null || productOverride === undefined ? null : boolFromDb(productOverride);
    const categoryAllowed = boolFromDb(row?.category_cod_enabled);
    const eligible = productAllowed === null ? categoryAllowed : productAllowed;
    if (!eligible) blockedItems.push(String(row?.name || item.name || 'This product'));
  }

  return {
    eligible: blockedItems.length === 0,
    message: blockedItems.length
      ? `COD is not enabled for ${blockedItems.slice(0, 2).join(', ')}${blockedItems.length > 2 ? ' and more items' : ''}.`
      : 'COD is enabled for these products.',
    blockedItems,
  };
};

export const getAdminCodConfig = async () => {
  await ensureDeliveryServiceSchema();
  const [products, categories, pincodes] = await Promise.all([
    dbQuery<any>(
      `SELECT p.id, p.name, p.slug, p.image, p.cod_enabled AS cod_enabled, p.category_id, COALESCE(c.name, p.category) AS category
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.archived_at IS NULL
       ORDER BY p.created_at DESC`
    ),
    dbQuery<any>(
      `SELECT id, name, icon, color, cod_enabled
       FROM categories
       WHERE archived_at IS NULL
       ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC`
    ),
    dbQuery<any>('SELECT * FROM delivery_pincode_rules ORDER BY updated_at DESC, pincode ASC'),
  ]);

  return {
    products: products.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      image: p.image,
      category: p.category || '',
      categoryId: p.category_id == null ? undefined : Number(p.category_id),
      codEnabled: p.cod_enabled == null ? null : boolFromDb(p.cod_enabled),
    })),
    categories: categories.map((c: any) => ({
      id: String(c.id),
      name: c.name,
      icon: c.icon,
      color: c.color,
      codEnabled: boolFromDb(c.cod_enabled),
    })),
    pincodes: pincodes.map((p: any) => ({
      id: String(p.id),
      pincode: p.pincode,
      deliveryEnabled: boolFromDb(p.delivery_enabled),
      codEnabled: boolFromDb(p.cod_enabled),
      partnerName: p.partner_name,
      note: p.note || '',
    })),
  };
};
