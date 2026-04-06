"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
require("dotenv/config");
const ioredis_1 = __importDefault(require("ioredis"));
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
}
exports.redis = new ioredis_1.default(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
});
exports.redis.on("error", (error) => {
    console.error("Redis connection error", error);
});
