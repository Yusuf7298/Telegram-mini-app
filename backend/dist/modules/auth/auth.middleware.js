"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
async function authMiddleware(req, res, next) {
    const headerValue = req.headers["x-user-id"];
    const userId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!userId || !userId.trim()) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = userId;
    return next();
}
