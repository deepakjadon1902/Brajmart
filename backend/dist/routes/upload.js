"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const imagekit_1 = __importDefault(require("imagekit"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const UPLOADS_DIR = path_1.default.resolve(__dirname, '..', '..', 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR))
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
const imagekitConfig = {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, ''),
};
const imagekitConfigured = Boolean(imagekitConfig.publicKey && imagekitConfig.privateKey && imagekitConfig.urlEndpoint);
const imagekitEnabled = (() => {
    const forced = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim();
    if (forced === 'local')
        return false;
    if (forced === 'imagekit')
        return true;
    // Prefer local uploads in dev for speed/reliability.
    if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production')
        return false;
    return imagekitConfigured;
})();
const imagekitRequired = String(process.env.UPLOAD_PROVIDER || '').toLowerCase().trim() === 'imagekit';
const imagekit = imagekitEnabled && imagekitConfigured ? new imagekit_1.default(imagekitConfig) : null;
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
const sanitizeBaseName = (fileName) => {
    const base = path_1.default.basename(fileName, path_1.default.extname(fileName)) || 'image';
    return base.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'image';
};
const optimizeImageBuffer = async (buffer) => {
    const maxWidth = Math.max(320, Number(process.env.IMAGEKIT_UPLOAD_MAX_WIDTH || 2000));
    const quality = Math.min(92, Math.max(45, Number(process.env.IMAGEKIT_UPLOAD_QUALITY || 82)));
    return (0, sharp_1.default)(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: maxWidth, height: maxWidth, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();
};
const uploadToImageKit = async (buffer, originalName) => {
    if (!imagekit)
        throw new Error('ImageKit is not configured');
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
router.get('/status', auth_1.auth, auth_1.adminOnly, (_req, res) => {
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
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'No file uploaded' });
    try {
        if (!imagekitEnabled)
            return res.json({ url: publicUrlForLocalFile(req, file.filename) });
        const url = await withTimeout(uploadToImageKit(file.buffer, file.originalname), 15000);
        return res.json({ url });
    }
    catch (err) {
        console.error('Upload error:', err);
        if (imagekitRequired) {
            return res.status(502).json({ message: `ImageKit upload failed: ${err?.message || 'Upload failed'}` });
        }
        // ImageKit failed/slow: fallback to local so admin isn't blocked.
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
router.post('/multiple', (imagekitEnabled ? memoryUpload.array('images', 12) : diskUpload.array('images', 12)), async (req, res) => {
    const files = req.files || [];
    if (!files.length)
        return res.status(400).json({ message: 'No files uploaded' });
    try {
        if (!imagekitEnabled) {
            return res.json({ urls: files.map((f) => publicUrlForLocalFile(req, f.filename)) });
        }
        const urls = await withTimeout(Promise.all(files.map((f) => uploadToImageKit(f.buffer, f.originalname))), 25000);
        return res.json({ urls });
    }
    catch (err) {
        console.error('Multi upload error:', err);
        if (imagekitRequired) {
            return res.status(502).json({ message: `ImageKit upload failed: ${err?.message || 'Upload failed'}` });
        }
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
