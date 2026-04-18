import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

router.post('/', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const host = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const normalizedHost = host.replace(/\/$/, '');
  res.json({ url: `${normalizedHost}/uploads/${file.filename}` });
});

export default router;
