"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cloudinary_1 = __importDefault(require("cloudinary"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const streamifier_1 = __importDefault(require("streamifier"));
const router = (0, express_1.Router)();
const UPLOADS_DIR = path_1.default.resolve(__dirname, '..', '..', 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR))
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
const cloudinaryEnabled = (() => {
    const forced = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim();
    if (forced === 'local')
        return false;
    if (forced === 'cloudinary')
        return true;
    const hasKeys = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    // Prefer local uploads in dev for speed/reliability.
    if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production')
        return false;
    return hasKeys;
})();
if (cloudinaryEnabled) {
    cloudinary_1.default.v2.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
const maxFileSizeMb = Number(process.env.UPLOAD_MAX_MB || 25);
const maxFileSizeBytes = Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? Math.floor(maxFileSizeMb * 1024 * 1024) : 25 * 1024 * 1024;
const memoryUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes },
});
const diskUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || '').slice(0, 10) || '.jpg';
            const name = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}${ext}`;
            cb(null, name);
        },
    }),
    limits: { fileSize: maxFileSizeBytes },
});
const getPublicOrigin = (req) => {
    const envBase = String(process.env.BACKEND_URL || process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
    if (envBase)
        return envBase;
    const proto = String(req?.protocol || 'http');
    const host = String(req?.get?.('host') || '');
    return host ? `${proto}://${host}` : '';
};
const publicUrlForLocalFile = (req, filename) => {
    const origin = getPublicOrigin(req);
    const rel = `/uploads/${encodeURIComponent(filename)}`;
    return origin ? `${origin}${rel}` : rel;
};
const withTimeout = async (promise, ms) => {
    let t = null;
    const timeout = new Promise((_, reject) => {
        t = setTimeout(() => reject(new Error('Upload timed out')), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    }
    finally {
        if (t)
            clearTimeout(t);
    }
};
const uploadToCloudinary = (buffer) => new Promise((resolve, reject) => {
    const uploadStream = cloudinary_1.default.v2.uploader.upload_stream({ folder: 'brajmart', resource_type: 'image' }, (error, result) => {
        if (error || !result)
            return reject(error || new Error('Upload failed'));
        resolve(result.secure_url);
    });
    streamifier_1.default.createReadStream(buffer).pipe(uploadStream);
});
router.post('/', (cloudinaryEnabled ? memoryUpload.single('image') : diskUpload.single('image')), async (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'No file uploaded' });
    try {
        if (!cloudinaryEnabled)
            return res.json({ url: publicUrlForLocalFile(req, file.filename) });
        const url = await withTimeout(uploadToCloudinary(file.buffer), 15000);
        return res.json({ url });
    }
    catch (err) {
        console.error('Upload error:', err);
        // Cloudinary failed/slow → fallback to local so admin isn't blocked.
        try {
            const fallback = await new Promise((resolve, reject) => {
                const ext = path_1.default.extname(file.originalname || '').slice(0, 10) || '.jpg';
                const filename = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}${ext}`;
                const outPath = path_1.default.join(UPLOADS_DIR, filename);
                fs_1.default.writeFile(outPath, file.buffer, (e) => (e ? reject(e) : resolve(filename)));
            });
            return res.json({ url: publicUrlForLocalFile(req, fallback) });
        }
        catch {
            return res.status(500).json({ message: err?.message || 'Upload failed' });
        }
    }
});
router.post('/multiple', (cloudinaryEnabled ? memoryUpload.array('images', 12) : diskUpload.array('images', 12)), async (req, res) => {
    const files = req.files || [];
    if (!files.length)
        return res.status(400).json({ message: 'No files uploaded' });
    try {
        if (!cloudinaryEnabled) {
            return res.json({ urls: files.map((f) => publicUrlForLocalFile(req, f.filename)) });
        }
        const urls = await withTimeout(Promise.all(files.map((f) => uploadToCloudinary(f.buffer))), 25000);
        return res.json({ urls });
    }
    catch (err) {
        console.error('Multi upload error:', err);
        // Fallback: store everything locally.
        try {
            const urls = [];
            for (const f of files) {
                const ext = path_1.default.extname(f.originalname || '').slice(0, 10) || '.jpg';
                const filename = `${Date.now()}-${crypto_1.default.randomBytes(6).toString('hex')}${ext}`;
                const outPath = path_1.default.join(UPLOADS_DIR, filename);
                fs_1.default.writeFileSync(outPath, f.buffer);
                urls.push(publicUrlForLocalFile(req, filename));
            }
            return res.json({ urls });
        }
        catch {
            return res.status(500).json({ message: err?.message || 'Upload failed' });
        }
    }
});
router.use((err, _req, res, _next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ message: `Image too large. Max ${Math.round(maxFileSizeBytes / 1024 / 1024)}MB` });
    return res.status(500).json({ message: err?.message || 'Upload failed' });
});
exports.default = router;
