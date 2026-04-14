"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
// NEW: Admin permission middleware
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const apiResponse_1 = require("../utils/apiResponse");
// Hardened admin auth: require admin JWT role AND secondary secret
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status((0, apiResponse_1.getErrorStatus)('INTERNAL_ERROR')).json((0, apiResponse_1.structuredError)('INTERNAL_ERROR', 'Auth is not configured'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (payload.role !== 'ADMIN') {
            return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
        }
    }
    catch {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const adminSecret = process.env.ADMIN_SECONDARY_SECRET;
    const providedSecret = req.headers['x-admin-secret'];
    if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
        return res.status((0, apiResponse_1.getErrorStatus)('UNAUTHORIZED')).json((0, apiResponse_1.structuredError)('UNAUTHORIZED', 'Secondary admin secret required'));
    }
    next();
}
