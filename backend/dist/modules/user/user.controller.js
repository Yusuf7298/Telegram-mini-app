"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.getReferrals = getReferrals;
exports.getCurrentUser = getCurrentUser;
const db_1 = require("../../config/db");
const crypto_1 = require("crypto");
const crypto_2 = __importDefault(require("crypto"));
const responder_1 = require("../../utils/responder");
function isValidString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
async function registerUser(req, res) {
    try {
        const { platformId, username, referrerId } = req.body;
        if (!isValidString(platformId)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "platformId is required");
        }
        const normalizedReferrerId = isValidString(referrerId)
            ? referrerId
            : null;
        if (normalizedReferrerId) {
            const referrer = await db_1.prisma.user.findUnique({
                where: { id: normalizedReferrerId },
                select: { id: true },
            });
            if (!referrer) {
                return (0, responder_1.failure)(res, "INVALID_INPUT", "Invalid referrerId");
            }
        }
        const existing = await db_1.prisma.user.findUnique({
            where: { platformId },
        });
        if (existing)
            return (0, responder_1.success)(res, existing);
        const user = await db_1.prisma.user.create({
            data: {
                platformId,
                username: isValidString(username) ? username : null,
                referralCode: `REF-${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`,
                referredById: normalizedReferrerId,
                deviceHash: crypto_2.default.createHash("sha256").update(`${req.ip || "unknown"}|${req.headers["user-agent"] || ""}|${platformId}`).digest("hex"),
                createdIp: req.ip || "unknown",
                lastLoginIp: req.ip || "unknown",
                waitlistBonusEligible: false,
                waitlistBonusGranted: false,
                waitlistBonusUnlocked: false,
                totalPlaysCount: 0,
                wallet: {
                    create: {
                        bonusBalance: 0,
                        bonusLocked: true,
                    },
                },
            },
        });
        return (0, responder_1.success)(res, user);
    }
    catch (err) {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to create user");
    }
}
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
