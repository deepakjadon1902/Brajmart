import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  key?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const clientIp = (req: Request) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
};

export const rateLimit = (name: string, options: RateLimitOptions) => {
  const windowMs = Math.max(1000, options.windowMs);
  const max = Math.max(1, options.max);
  const message = options.message || 'Too many requests. Please try again later.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const keyPart = options.key ? options.key(req) : clientIp(req);
    const key = `${name}:${keyPart || clientIp(req)}`;
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ message });
    }

    next();
  };
};

export const rateLimitKeyByIpAndEmail = (emailField = 'email') => (req: Request) => {
  const email = String((req.body as any)?.[emailField] || (req.body as any)?.customer?.email || '').trim().toLowerCase();
  return `${clientIp(req)}:${email}`;
};

export const rateLimitKeyByIpAndOrderEmail = (req: Request) => {
  const body = req.body as any;
  const email = String(body?.customer?.email || body?.customerEmail || body?.order?.customerEmail || '').trim().toLowerCase();
  return `${clientIp(req)}:${email}`;
};
