"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("cloudinary"));
const streamifier_1 = __importDefault(require("streamifier"));
const router = (0, express_1.Router)();
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadToCloudinary = (buffer) => new Promise((resolve, reject) => {
    const uploadStream = cloudinary_1.default.v2.uploader.upload_stream({ folder: 'brajmart', resource_type: 'image' }, (error, result) => {
        if (error || !result)
            return reject(error || new Error('Upload failed'));
        resolve(result.secure_url);
    });
    streamifier_1.default.createReadStream(buffer).pipe(uploadStream);
});
router.post('/', upload.single('image'), async (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'No file uploaded' });
    try {
        const url = await uploadToCloudinary(file.buffer);
        res.json({ url });
    }
    catch (err) {
        console.error('Cloudinary upload error:', err);
        res.status(500).json({ message: err === null || err === void 0 ? void 0 : err.message || 'Upload failed' });
    }
});
exports.default = router;
