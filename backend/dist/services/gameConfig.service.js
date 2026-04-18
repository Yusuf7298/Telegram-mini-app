"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateGameConfigCache = invalidateGameConfigCache;
exports.getValidatedGameConfig = getValidatedGameConfig;
exports.assertGameConfigOnStartup = assertGameConfigOnStartup;
exports.validateGameConfigOrThrow = validateGameConfigOrThrow;
const db_1 = require("../config/db");
const GAME_CONFIG_ID = "global";
const GAME_CONFIG_CACHE_TTL_MS = 10000;
let cachedGameConfig = null;
let cachedAtMs = 0;
function nowMs() {
    return Date.now();
}
function isCacheFresh() {
    return !!cachedGameConfig && nowMs() - cachedAtMs < GAME_CONFIG_CACHE_TTL_MS;
}
function toFiniteNumber(value, fieldName) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    throw new Error(`CRITICAL: GameConfig.${fieldName} is not a finite number`);
}
function validateGameConfigOrThrow(config) {
    const minBoxReward = toFiniteNumber(config.minBoxReward, "minBoxReward");
    const maxBoxReward = toFiniteNumber(config.maxBoxReward, "maxBoxReward");
    const referralRewardAmount = config.referralRewardAmount.toNumber();
    const waitlistBonus = toFiniteNumber(config.waitlistBonus, "waitlistBonus");
    if (!(minBoxReward < maxBoxReward)) {
        throw new Error("CRITICAL: Invalid GameConfig: minBoxReward must be less than maxBoxReward");
    }
    if (!(referralRewardAmount > 0)) {
        throw new Error("CRITICAL: Invalid GameConfig: referralRewardAmount must be greater than 0");
    }
    if (waitlistBonus < 0) {
        throw new Error("CRITICAL: Invalid GameConfig: waitlistBonus must be greater than or equal to 0");
    }
    return config;
}
function getDbClient(client) {
    return client ?? db_1.prisma;
}
async function fetchRawGameConfig(client) {
    const db = getDbClient(client);
    const config = await db.gameConfig.findFirst({
        where: { id: GAME_CONFIG_ID },
        select: {
            id: true,
            rtpModifier: true,
            referralRewardAmount: true,
            freeBoxRewardAmount: true,
            minBoxReward: true,
            maxBoxReward: true,
            waitlistBonus: true,
            dailyRewardTable: true,
            dailyRewardBigWinThreshold: true,
            winHistoryBigWinThreshold: true,
        },
    });
    if (!config) {
        throw new Error("CRITICAL: GameConfig row is missing. Refusing to continue.");
    }
    return config;
}
function invalidateGameConfigCache() {
    cachedGameConfig = null;
    cachedAtMs = 0;
}
async function getValidatedGameConfig(options) {
    const useCache = !options?.client && !options?.bypassCache;
    if (useCache && isCacheFresh() && cachedGameConfig) {
        return cachedGameConfig;
    }
    const config = validateGameConfigOrThrow(await fetchRawGameConfig(options?.client));
    if (useCache) {
        cachedGameConfig = config;
        cachedAtMs = nowMs();
    }
    return config;
}
async function assertGameConfigOnStartup() {
    await getValidatedGameConfig({ bypassCache: true });
}
