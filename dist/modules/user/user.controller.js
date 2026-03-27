"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.getReferrals = getReferrals;
exports.getCurrentUser = getCurrentUser;
const db_1 = require("../../config/db");
function isValidString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
async function registerUser(req, res) {
    try {
        const { platformId, username, referrerId } = req.body;
        if (!isValidString(platformId)) {
            return res.status(400).json({ success: false, error: "platformId is required" });
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
                return res.status(400).json({ success: false, error: "Invalid referrerId" });
            }
        }
        const existing = await db_1.prisma.user.findUnique({
            where: { platformId },
        });
        if (existing)
            return res.json({ success: true, data: existing });
        const user = await db_1.prisma.user.create({
            data: {
                platformId,
                username: isValidString(username) ? username : null,
                referredBy: normalizedReferrerId,
                wallet: { create: {} },
            },
        });
        return res.json({ success: true, data: user });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: "Failed to create user" });
    }
}
async function getReferrals(req, res) {
    try {
        const userId = req.userId;
        if (!userId?.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { referrals: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        return res.json({ success: true, data: user });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: "Failed to fetch referrals" });
    }
}
async function getCurrentUser(req, res) {
    try {
        const userId = req.userId;
        if (!userId?.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }
        return res.json({ success: true, data: user });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: "Failed to fetch user" });
    }
}
