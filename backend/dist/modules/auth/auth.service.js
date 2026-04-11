"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authWithTelegram = authWithTelegram;
exports.generateToken = generateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../../config/db");
const crypto_1 = require("crypto");
const WAITLIST_BONUS_AMOUNT = 1000;
function parseTelegramUser(initData) {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) {
        throw new Error("Telegram user payload is missing");
    }
    const userData = JSON.parse(userRaw);
    if (!userData?.id) {
        throw new Error("Telegram user id is missing");
    }
    return userData;
}
async function authWithTelegram(initData) {
    const userData = parseTelegramUser(initData);
    const platformId = String(userData.id);
    const username = typeof userData.username === "string" && userData.username.trim()
        ? userData.username
        : null;
    const referralCode = `REF-${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`;
    return db_1.prisma.user.upsert({
        where: { platformId },
        create: {
            platformId,
            username,
            referralCode,
            waitlistBonusGranted: true,
            waitlistBonusUnlocked: false,
            totalPlaysCount: 0,
            wallet: {
                create: {
                    bonusBalance: WAITLIST_BONUS_AMOUNT,
                    bonusLocked: true,
                },
            },
        },
        update: {
            username,
        },
    });
}
function generateToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: "7d" });
}
