import Redis from "ioredis";
import { env } from "./env";

const redisUrl = env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on("error", (error) => {
  console.error("Redis connection error", error);
});
