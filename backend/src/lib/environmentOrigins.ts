const clean = (value: unknown) => String(value ?? '').trim();
const isStaging = (env: NodeJS.ProcessEnv) => clean(env.APP_ENV).toLowerCase() === 'staging';

const productionHosts = new Set(['brajmart.com', 'www.brajmart.com', 'api.brajmart.com', 'labels.brajmart.com']);

const normalizeConfiguredOrigin = (value: string) => {
  const configured = clean(value);
  try {
    const parsed = new URL(configured);
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
      && parsed.pathname === '/' && !parsed.search && !parsed.hash) return parsed.origin;
  } catch {
    // Invalid entries cannot match a browser origin. Do not expand them into a wildcard.
  }
  return configured;
};

const isVercelProjectOrigin = (origin: string, env: NodeJS.ProcessEnv) => {
  const project = clean(env.CORS_VERCEL_PROJECT).toLowerCase();
  const scope = clean(env.CORS_VERCEL_SCOPE).toLowerCase();
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slug.test(project) || !slug.test(scope)) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.port || parsed.origin !== origin) return false;
    const prefix = `${project}-`;
    const suffix = `-${scope}.vercel.app`;
    if (!parsed.hostname.startsWith(prefix) || !parsed.hostname.endsWith(suffix)) return false;
    if (parsed.hostname.slice(0, -'.vercel.app'.length).length > 63) return false;
    const deployment = parsed.hostname.slice(prefix.length, -suffix.length);
    // Vercel generates a hash for each deployment and a git-<branch> alias.
    return /^(?:[a-z0-9]+|git-[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(deployment);
  } catch {
    return false;
  }
};

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
      clean(env.FRONTEND_URL),
    ].map(normalizeConfiguredOrigin).filter(Boolean)));
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
  if (allowedOrigins.includes(origin)) return true;
  return !isStaging(env) && isVercelProjectOrigin(origin, env);
};

