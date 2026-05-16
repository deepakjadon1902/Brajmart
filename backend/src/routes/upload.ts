import { Router } from 'express';
import cloudinary from 'cloudinary';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import streamifier from 'streamifier';

const router = Router();

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const cloudinaryEnabled = (() => {
  const forced = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim();
  if (forced === 'local') return false;
  if (forced === 'cloudinary') return true;
  const hasKeys = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  // Prefer local uploads in dev for speed/reliability.
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') return false;
  return hasKeys;
})();

if (cloudinaryEnabled) {
  cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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

const uploadToCloudinary = (buffer: Buffer) =>
  new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      { folder: 'brajmart', resource_type: 'image' },
      (error: any, result: any) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

router.post('/', (cloudinaryEnabled ? memoryUpload.single('image') : diskUpload.single('image')), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    if (!cloudinaryEnabled) return res.json({ url: publicUrlForLocalFile(req, file.filename) });
    const url = await withTimeout(uploadToCloudinary((file as any).buffer as Buffer), 15_000);
    return res.json({ url });
  } catch (err: any) {
    console.error('Upload error:', err);
    // Cloudinary failed/slow → fallback to local so admin isn't blocked.
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

router.post('/multiple', (cloudinaryEnabled ? memoryUpload.array('images', 12) : diskUpload.array('images', 12)), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) || [];
  if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

  try {
    if (!cloudinaryEnabled) {
      return res.json({ urls: files.map((f) => publicUrlForLocalFile(req, f.filename)) });
    }

    const urls = await withTimeout(
      Promise.all(files.map((f: any) => uploadToCloudinary(f.buffer as Buffer))),
      25_000
    );
    return res.json({ urls });
  } catch (err: any) {
    console.error('Multi upload error:', err);
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
