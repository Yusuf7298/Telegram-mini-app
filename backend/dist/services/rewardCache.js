"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBoxRewards = getBoxRewards;
const boxRewardCache = new Map();
const CACHE_TTL_MS = 60000;
async function getBoxRewards(boxId, tx) {
    const now = Date.now();
    const cached = boxRewardCache.get(boxId);
    if (cached && cached.expires > now) {
        return cached.rewards;
    }
    const rewards = await tx.boxReward.findMany({ where: { boxId } });
    boxRewardCache.set(boxId, { rewards, expires: now + CACHE_TTL_MS });
    return rewards;
}
