"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withUserLock = withUserLock;
// Distributed user lock using Redlock and Redis
const redlock_1 = __importDefault(require("redlock"));
const redis_1 = require("../config/redis");
const redlock = new redlock_1.default([
    redis_1.redis
], {
    retryCount: 10,
    retryDelay: 100,
    retryJitter: 100,
});
const LOCK_TTL = 5000; // 5 seconds
async function withUserLock(userId, fn) {
    const resource = `locks:user:${userId}`;
    let lock;
    try {
        lock = await redlock.acquire([resource], LOCK_TTL);
        return await fn();
    }
    finally {
        if (lock) {
            try {
                await lock.release();
            }
            catch { }
        }
    }
}
