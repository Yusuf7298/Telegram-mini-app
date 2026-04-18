"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
exports.requireSuperAdmin = requireSuperAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const apiResponse_1 = require("../utils/apiResponse");
function isAdminRole(role) {
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
function getProvidedAdminSecret(req) {
    const value = req.headers['x-admin-secret'];
    return typeof value === 'string' ? value : undefined;
}
async function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const secret = env_1.env.JWT_SECRET;
    if (!secret) {
        return res.status((0, apiResponse_1.getErrorStatus)('INTERNAL_ERROR')).json((0, apiResponse_1.structuredError)('INTERNAL_ERROR', 'Auth is not configured'));
    }
    let userId;
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        userId = payload.userId;
    }
    catch {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    if (!userId) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });
    if (!user || !isAdminRole(user.role)) {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Admin access required'));
    }
    const adminSecret = env_1.env.ADMIN_SECRET;
    const providedSecret = getProvidedAdminSecret(req);
    if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
        return res.status((0, apiResponse_1.getErrorStatus)('UNAUTHORIZED')).json((0, apiResponse_1.structuredError)('UNAUTHORIZED', 'Secondary admin secret required'));
    }
    req.userId = user.id;
    req.user = {
        id: user.id,
        role: user.role,
    };
    return next();
}
function requireSuperAdmin(req, res, next) {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status((0, apiResponse_1.getErrorStatus)('FORBIDDEN')).json((0, apiResponse_1.structuredError)('FORBIDDEN', 'Super admin access required'));
    }
    return next();
}
