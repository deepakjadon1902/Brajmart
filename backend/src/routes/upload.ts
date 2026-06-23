import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import ImageKit from 'imagekit';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { auth, adminOnly } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const imagekitConfig = {
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, ''),
};
const imagekitConfigured = Boolean(imagekitConfig.publicKey && imagekitConfig.privateKey && imagekitConfig.urlEndpoint);

const imagekitEnabled = (() => {
  const forced = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim();
  if (forced === 'local') return false;
  if (forced === 'imagekit') return true;
  // Prefer local uploads in dev for speed/reliability.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') return false;
  return imagekitConfigured;
})();
const imagekitRequired = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim() === 'imagekit';

const imagekit = imagekitEnabled && imagekitConfigured ? new ImageKit(imagekitConfig) : null;

const maxFileSizeMb = Number(process.env.UPLOAD_MAX_MB || 25);
const maxFileSizeBytes = Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? Math.floor(maxFileSizeMb * 1024 * 1024) : 25 * 1024 * 1024;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
});

const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: maxFileSizeBytes },
});

const getPublicOrigin = (req: any) => {
  const envBase = String(process.env.BACKEND_URL || process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (envBase) return envBase;
  const proto = String(req?.protocol || 'http');
  const host = String(req?.get?.('host') || '');
  return host ? `${proto}://${host}` : '';
};

const publicUrlForLocalFile = (req: any, filename: string) => {
  const origin = getPublicOrigin(req);
  const rel = `/uploads/${encodeURIComponent(filename)}`;
  return origin ? `${origin}${rel}` : rel;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  let t: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error('Upload timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
};

const sanitizeBaseName = (fileName: string) => {
  const base = path.basename(fileName, path.extname(fileName)) || 'image';
  return base.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'image';
};

const optimizeImageBuffer = async (buffer: Buffer) => {
  const maxWidth = Math.max(320, Number(process.env.IMAGEKIT_UPLOAD_MAX_WIDTH || 2000));
  const quality = Math.min(92, Math.max(45, Number(process.env.IMAGEKIT_UPLOAD_QUALITY || 82)));
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
};

const uploadToImageKit = async (buffer: Buffer, originalName: string) => {
  if (!imagekit) throw new Error('ImageKit is not configured');
  const optimized = await optimizeImageBuffer(buffer);
  const result = await imagekit.upload({
    file: optimized,
    fileName: `${sanitizeBaseName(originalName)}.webp`,
    folder: process.env.IMAGEKIT_FOLDER || '/brajmart',
    useUniqueFileName: true,
    tags: ['brajmart', 'optimized'],
    responseFields: ['width', 'height', 'size', 'filePath'],
  });
  return result.url;
};

router.get('/status', auth, adminOnly, (_req, res) => {
  const provider = imagekitEnabled ? 'imagekit' : 'local';
  res.json({
    provider,
    imagekitConfigured,
    imagekitRequired,
    folder: process.env.IMAGEKIT_FOLDER || '/brajmart',
    urlEndpoint: imagekitConfig.urlEndpoint || null,
    maxUploadMb: maxFileSizeMb,
    optimize: {
      maxWidth: Math.max(320, Number(process.env.IMAGEKIT_UPLOAD_MAX_WIDTH || 2000)),
      quality: Math.min(92, Math.max(45, Number(process.env.IMAGEKIT_UPLOAD_QUALITY || 82))),
    },
  });
});

router.post('/', (imagekitEnabled ? memoryUpload.single('image') : diskUpload.single('image')), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    if (!imagekitEnabled) return res.json({ url: publicUrlForLocalFile(req, file.filename) });
    const url = await withTimeout(uploadToImageKit((file as any).buffer as Buffer, file.originalname), 15_000);
    return res.json({ url });
  } catch (err: any) {
    console.error('Upload error:', err);
    if (imagekitRequired) {
      return res.status(502).json({ message: `ImageKit upload failed: ${err?.message || 'Upload failed'}` });
    }
    // ImageKit failed/slow: fallback to local so admin isn't blocked.
    try {
      const fallback = await new Promise<string>((resolve, reject) => {
        const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const outPath = path.join(UPLOADS_DIR, filename);
        fs.writeFile(outPath, (file as any).buffer as Buffer, (e) => (e ? reject(e) : resolve(filename)));
      });
      return res.json({ url: publicUrlForLocalFile(req, fallback) });
    } catch {
      return res.status(500).json({ message: err?.message || 'Upload failed' });
    }
  }
});

router.post('/multiple', (imagekitEnabled ? memoryUpload.array('images', 12) : diskUpload.array('images', 12)), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

  try {
    if (!imagekitEnabled) {
      return res.json({ urls: files.map((f) => publicUrlForLocalFile(req, f.filename)) });
    }

    const urls = await withTimeout(
      Promise.all(files.map((f: any) => uploadToImageKit(f.buffer as Buffer, f.originalname))),
      25_000
    );
    return res.json({ urls });
  } catch (err: any) {
    console.error('Multi upload error:', err);
    if (imagekitRequired) {
      return res.status(502).json({ message: `ImageKit upload failed: ${err?.message || 'Upload failed'}` });
    }
    // Fallback: store everything locally.
    try {
      const urls: string[] = [];
      for (const f of files as any[]) {
        const ext = path.extname(f.originalname || '').slice(0, 10) || '.jpg';
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const outPath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(outPath, f.buffer as Buffer);
        urls.push(publicUrlForLocalFile(req, filename));
      }
      return res.json({ urls });
    } catch {
      return res.status(500).json({ message: err?.message || 'Upload failed' });
    }
  }
});

router.use((err: any, _req: any, res: any, _next: any) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: `Image too large. Max ${Math.round(maxFileSizeBytes / 1024 / 1024)}MB` });
  return res.status(500).json({ message: err?.message || 'Upload failed' });
});

export default router;
