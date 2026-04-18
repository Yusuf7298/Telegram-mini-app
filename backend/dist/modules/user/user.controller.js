"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferrals = getReferrals;
exports.getCurrentUser = getCurrentUser;
const db_1 = require("../../config/db");
const responder_1 = require("../../utils/responder");
async function getReferrals(req, res) {
    try {
        const userId = req.userId;
        if (!userId?.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { referrals: true },
        });
        if (!user) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        return (0, responder_1.success)(res, user);
    }
    catch (err) {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch referrals");
    }
}
async function getCurrentUser(req, res) {
    try {
        const userId = req.userId;
        if (!userId?.trim()) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        return (0, responder_1.success)(res, user);
    }
    catch (err) {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch user");
    }
}
