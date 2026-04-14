"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordBoxOpenAttempt = recordBoxOpenAttempt;
exports.recordRewardEvent = recordRewardEvent;
exports.recordWithdrawAttempt = recordWithdrawAttempt;
const client_1 = require("@prisma/client");
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const OPEN_BOX_LIMIT_PER_MINUTE = 20;
const WITHDRAW_ATTEMPT_LIMIT = 3;
const WITHDRAW_SHORT_WINDOW_MS = 30 * 1000;
const userFraudState = new Map();
function toNumber(value) {
    if (value instanceof client_1.Prisma.Decimal) {
        return value.toNumber();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function getUserState(userId) {
    const existing = userFraudState.get(userId);
    if (existing) {
        return existing;
    }
    const nextState = {
        openBoxCalls: [],
        rewardEvents: [],
        withdrawAttempts: [],
    };
    userFraudState.set(userId, nextState);
    return nextState;
}
function pruneState(state, now) {
    state.openBoxCalls = state.openBoxCalls.filter((timestamp) => now - timestamp <= ONE_MINUTE_MS);
    state.rewardEvents = state.rewardEvents.filter((event) => now - event.at <= ONE_HOUR_MS);
    state.withdrawAttempts = state.withdrawAttempts.filter((timestamp) => now - timestamp <= WITHDRAW_SHORT_WINDOW_MS);
}
function recordBoxOpenAttempt(userId) {
    const now = Date.now();
    const state = getUserState(userId);
    pruneState(state, now);
    state.openBoxCalls.push(now);
    if (state.openBoxCalls.length > OPEN_BOX_LIMIT_PER_MINUTE) {
        return {
            isSuspicious: true,
            reason: "box_open_rate_high",
        };
    }
    return { isSuspicious: false };
}
function recordRewardEvent(userId, rewardAmount) {
    const now = Date.now();
    const state = getUserState(userId);
    pruneState(state, now);
    const amount = toNumber(rewardAmount);
    const rewardSnapshot = { at: now, amount };
    const averageReward = state.rewardEvents.length === 0
        ? amount
        : state.rewardEvents.reduce((sum, event) => sum + event.amount, 0) / state.rewardEvents.length;
    state.rewardEvents.push(rewardSnapshot);
    if (state.rewardEvents.length > 1 && averageReward > 0 && amount > averageReward * 5) {
        return {
            isSuspicious: true,
            reason: "reward_spike_detected",
        };
    }
    return { isSuspicious: false };
}
function recordWithdrawAttempt(userId) {
    const now = Date.now();
    const state = getUserState(userId);
    pruneState(state, now);
    state.withdrawAttempts.push(now);
    if (state.withdrawAttempts.length >= WITHDRAW_ATTEMPT_LIMIT) {
        return {
            isSuspicious: true,
            reason: "withdraw_frequency_high",
        };
    }
    return { isSuspicious: false };
}
