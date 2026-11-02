export const sanitizeBuildDiagnostic = (value, env = process.env) => {
  let message = String(value ?? '');
  message = message.replace(/https?:\/\/[^\s"'<>]+/gi, (raw) => {
    try {
      const url = new URL(raw);
      return `${url.origin}${url.pathname}`;
    } catch { return '[redacted URL]'; }
  });
  for (const [key, secret] of Object.entries(env)) {
    if (/SECRET|PASSWORD|TOKEN|API_KEY|DATABASE_URL/i.test(key) && typeof secret === 'string' && secret.length >= 4) {
      message = message.replaceAll(secret, '[REDACTED]');
    }
  }
  return message
    .replace(/\bBearer\s+[^\s,"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(password|secret|token|api[_-]?key)\s*[:=]\s*["']?[^\s,"';]+/gi, '$1=[REDACTED]');
};

export const describeCatalogEntry = (collection, index, entry) => {
  const identity = entry && typeof entry === 'object'
    ? Object.entries({ id: entry.id ?? entry._id, name: entry.name ?? entry.title, slug: entry.slug })
      .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
      .map(([key, value]) => `${key}=${JSON.stringify(sanitizeBuildDiagnostic(value).slice(0, 160))}`).join(' ')
    : `type=${entry === null ? 'null' : typeof entry}`;
  return `${collection}[${index}]${identity ? ` ${identity}` : ''}`;
};
