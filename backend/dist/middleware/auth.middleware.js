"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const apiResponse_1 = require("../utils/apiResponse");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status((0, apiResponse_1.getErrorStatus)("UNAUTHORIZED")).json((0, apiResponse_1.structuredError)("UNAUTHORIZED", "Unauthorized"));
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
        return res.status((0, apiResponse_1.getErrorStatus)("UNAUTHORIZED")).json((0, apiResponse_1.structuredError)("UNAUTHORIZED", "Unauthorized"));
    }
    const secret = env_1.env.JWT_SECRET;
    if (!secret) {
        return res.status((0, apiResponse_1.getErrorStatus)("INTERNAL_ERROR")).json((0, apiResponse_1.structuredError)("INTERNAL_ERROR", "Auth is not configured"));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (!payload?.userId || !payload.userId.trim()) {
            return res.status((0, apiResponse_1.getErrorStatus)("UNAUTHORIZED")).json((0, apiResponse_1.structuredError)("UNAUTHORIZED", "Unauthorized"));
        }
        req.userId = payload.userId;
        return next();
    }
    catch {
        return res.status((0, apiResponse_1.getErrorStatus)("UNAUTHORIZED")).json((0, apiResponse_1.structuredError)("UNAUTHORIZED", "Unauthorized"));
    }
}
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status((0, apiResponse_1.getErrorStatus)('UNAUTHORIZED')).json((0, apiResponse_1.structuredError)('UNAUTHORIZED', 'Unauthorized'));
    }
    const token = authHeader.split(' ')[1];
    const secret = env_1.env.JWT_SECRET;
    if (!secret) {
        return res.status((0, apiResponse_1.getErrorStatus)('INTERNAL_ERROR')).json((0, apiResponse_1.structuredError)('INTERNAL_ERROR', 'Auth is not configured'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
            return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Forbidden: Admins only'));
        }
        req.user = payload;
        next();
    }
    catch {
        return res.status((0, apiResponse_1.getErrorStatus)('UNAUTHORIZED')).json((0, apiResponse_1.structuredError)('UNAUTHORIZED', 'Invalid token'));
    }
}
