"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbHealthCached = getDbHealthCached;
exports.rejectIfDbUnhealthy = rejectIfDbUnhealthy;
exports.dbHealthGuardMiddleware = dbHealthGuardMiddleware;
const db_1 = require("../config/db");
const DB_HEALTH_CACHE_MS = Math.min(5000, Math.max(2000, Number(process.env.DB_HEALTH_CACHE_MS ?? "3000")));
const dbHealthCache = {
    lastCheckedAt: 0,
    isHealthy: true,
    lastError: null,
    inFlight: null,
};
async function queryDbHealth() {
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        return { isHealthy: true, error: null };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isHealthy: false, error: message };
    }
}
async function getDbHealthCached() {
    const now = Date.now();
    const cacheStillValid = now - dbHealthCache.lastCheckedAt < DB_HEALTH_CACHE_MS;
    if (cacheStillValid) {
        return {
            isHealthy: dbHealthCache.isHealthy,
            error: dbHealthCache.lastError,
        };
    }
    if (!dbHealthCache.inFlight) {
        dbHealthCache.inFlight = queryDbHealth().then((result) => {
            dbHealthCache.lastCheckedAt = Date.now();
            dbHealthCache.isHealthy = result.isHealthy;
            dbHealthCache.lastError = result.error;
            dbHealthCache.inFlight = null;
            return result;
        });
    }
    return dbHealthCache.inFlight;
}
async function rejectIfDbUnhealthy(res) {
    const { isHealthy } = await getDbHealthCached();
    if (!isHealthy) {
        res.status(503).json({ error: "Service temporarily unavailable" });
        return true;
    }
    return false;
}
async function dbHealthGuardMiddleware(req, res, next) {
    const blocked = await rejectIfDbUnhealthy(res);
    if (blocked) {
        return;
    }
    next();
}
