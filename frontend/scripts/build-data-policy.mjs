export const isStrictSeoBuild = (env = process.env) => {
  const isDeploymentBuild = env.VERCEL === '1'
    || Boolean(env.VERCEL_ENV)
    || env.CI === '1'
    || String(env.CI || '').toLowerCase() === 'true';

  if (isDeploymentBuild) return true;
  return String(env.SEO_STRICT_BUILD ?? 'true').toLowerCase() !== 'false';
};
