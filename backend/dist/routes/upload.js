"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
const UPLOADS_DIR = path_1.default.join(__dirname, '..', 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR))
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = (0, multer_1.default)({ storage });
router.post('/', upload.single('image'), (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'No file uploaded' });
    const host = req.get('host');
    const protocol = req.protocol;
    res.json({ url: `${protocol}://${host}/uploads/${file.filename}` });
});
exports.default = router;
