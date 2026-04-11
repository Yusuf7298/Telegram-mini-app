"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ success: false, error: "Auth is not configured" });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (!payload?.userId || !payload.userId.trim()) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }
        req.userId = payload.userId;
        return next();
    }
    catch {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
}
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Auth is not configured' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (payload.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Admins only' });
        }
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
