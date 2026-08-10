"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnly = exports.optionalAuth = exports.auth = exports.getJwtSecret = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET || '';
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!secret && isProduction)
        throw new Error('JWT_SECRET is not configured');
    return secret || 'dev-secret-change-me';
};
exports.getJwtSecret = getJwtSecret;
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token)
        return res.status(401).json({ message: 'No token, access denied' });
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)());
        req.user = decoded;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
exports.auth = auth;
const optionalAuth = (req, _res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token)
        return next();
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, exports.getJwtSecret)());
        req.user = decoded;
    }
    catch {
        req.user = undefined;
    }
    next();
};
exports.optionalAuth = optionalAuth;
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};
exports.adminOnly = adminOnly;
