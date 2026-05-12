export const parseJson = <T>(value: any, fallback: T): T => {
  if (value === null || value === undefined) return fallback;

  // MySQL drivers may return JSON/TEXT/BLOB columns as Buffer/Uint8Array.
  // Convert to string first so we can JSON.parse it reliably.
  // (Hostinger/phpMyAdmin often shows these columns as BLOB.)
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    try {
      const asString = value.toString('utf8');
      return JSON.parse(asString) as T;
    } catch {
      return fallback;
    }
  }
  if (value instanceof Uint8Array) {
    try {
      const asString = new TextDecoder('utf-8').decode(value);
      return JSON.parse(asString) as T;
    } catch {
      return fallback;
    }
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

export const toIsoString = (value: any) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export const boolFromDb = (value: any) => Boolean(value);
