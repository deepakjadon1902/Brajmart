"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const products_1 = __importDefault(require("./routes/products"));
const categories_1 = __importDefault(require("./routes/categories"));
const orders_1 = __importDefault(require("./routes/orders"));
const payments_1 = __importDefault(require("./routes/payments"));
const settings_1 = __importDefault(require("./routes/settings"));
const upload_1 = __importDefault(require("./routes/upload"));
const payu_1 = __importDefault(require("./routes/payu"));
const upi_1 = __importDefault(require("./routes/upi"));
const cart_1 = __importDefault(require("./routes/cart"));
const heroSlides_1 = __importDefault(require("./routes/heroSlides"));
const blogs_1 = __importDefault(require("./routes/blogs"));
const app = (0, express_1.default)();
const UPLOADS_DIR = path_1.default.join(__dirname, '..', 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR))
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
app.use('/api/auth', auth_1.default);
app.use('/api/users', users_1.default);
app.use('/api/products', products_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/payu', payu_1.default);
app.use('/api/upi', upi_1.default);
app.use('/api/cart', cart_1.default);
app.use('/api/hero-slides', heroSlides_1.default);
app.use('/api/blogs', blogs_1.default);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});
exports.default = app;
