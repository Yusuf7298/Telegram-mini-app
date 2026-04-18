"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyRewardStatusHandler = getDailyRewardStatusHandler;
exports.claimDailyRewardHandler = claimDailyRewardHandler;
exports.getWinHistoryHandler = getWinHistoryHandler;
const responder_1 = require("../../utils/responder");
const rewards_service_1 = require("./rewards.service");
function getRequestUserId(req) {
    return req.userId;
}
function parseLimit(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
}
async function getDailyRewardStatusHandler(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        }
        const status = await (0, rewards_service_1.getDailyRewardStatus)(userId);
        return (0, responder_1.success)(res, status);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch daily reward status";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function claimDailyRewardHandler(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        }
        const claimResult = await (0, rewards_service_1.claimDailyReward)(userId);
        return (0, responder_1.success)(res, claimResult);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to claim daily reward";
        if (message === "Daily reward already claimed") {
            return (0, responder_1.failure)(res, "INVALID_INPUT", message);
        }
        if (message === "Account restricted") {
            return (0, responder_1.failure)(res, "FORBIDDEN", message);
        }
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function getWinHistoryHandler(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "UNAUTHORIZED", "Unauthorized");
        }
        const history = await (0, rewards_service_1.getWinHistory)(userId, parseLimit(req.query.limit));
        return (0, responder_1.success)(res, history);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch win history");
    }
}
