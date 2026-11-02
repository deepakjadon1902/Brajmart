const clean = (value: unknown) => String(value ?? '').trim();
const isStaging = (env: NodeJS.ProcessEnv) => clean(env.APP_ENV).toLowerCase() === 'staging';

const productionHosts = new Set(['brajmart.com', 'www.brajmart.com', 'api.brajmart.com', 'labels.brajmart.com']);

const parseStagingOrigin = (value: string, setting: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${setting} must contain HTTPS origins for staging`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${setting} must contain HTTPS origins for staging`);
  }
  if (productionHosts.has(parsed.hostname.toLowerCase().replace(/\.$/, ''))) {
    throw new Error(`${setting} must not contain a production BrajMart origin`);
  }
  return parsed.origin;
};

export const resolveSiteUrl = (env: NodeJS.ProcessEnv = process.env) => {
  if (!isStaging(env)) return clean(env.SITE_URL || 'https://www.brajmart.com').replace(/\/$/, '');
  const configured = clean(env.SITE_URL);
  if (!configured) throw new Error('SITE_URL is required for staging');
  return parseStagingOrigin(configured, 'SITE_URL');
};

export const resolveCorsOrigins = (
  env: NodeJS.ProcessEnv = process.env,
  defaults: string[] = [],
) => {
  if (!isStaging(env)) {
    return Array.from(new Set([
      ...defaults,
      ...clean(env.CORS_ORIGIN).split(',').map((origin) => origin.trim()).filter(Boolean),
    ]));
  }
  const configured = clean(env.CORS_ORIGIN).split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!configured.length) throw new Error('CORS_ORIGIN must explicitly list the staging frontend origin');
  const origins = Array.from(new Set(configured.map((origin) => parseStagingOrigin(origin, 'CORS_ORIGIN'))));
  const frontendUrl = clean(env.FRONTEND_URL);
  if (!frontendUrl) throw new Error('FRONTEND_URL is required for staging CORS validation');
  const frontendOrigin = parseStagingOrigin(frontendUrl, 'FRONTEND_URL');
  if (!origins.includes(frontendOrigin)) throw new Error('CORS_ORIGIN must include the configured staging FRONTEND_URL');
  return origins;
};

export const isCorsOriginAllowed = (origin: string | undefined, allowedOrigins: string[], env: NodeJS.ProcessEnv = process.env) => {
  if (!origin) return true;
  if (isStaging(env) && origin === 'null') return false;
  if (!isStaging(env) && origin === 'null') return true;
  return allowedOrigins.includes(origin);
};

