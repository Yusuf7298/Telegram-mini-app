"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
// Hardened admin auth: require admin role AND secondary secret
function requireAdminAuth(req, res, next) {
    const requestUser = req.user;
    if (!requestUser || requestUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    // Require secondary secret (env key)
    const adminSecret = process.env.ADMIN_SECONDARY_SECRET;
    const providedSecret = req.headers['x-admin-secret'];
    if (!adminSecret || !providedSecret || providedSecret !== adminSecret) {
        return res.status(401).json({ error: 'Secondary admin secret required' });
    }
    next();
}
