"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authWithTelegram = authWithTelegram;
exports.generateToken = generateToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const db_1 = require("../../config/db");
const crypto_1 = require("crypto");
const crypto_2 = __importDefault(require("crypto"));
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
function computeDeviceHash(params) {
    const raw = [params.deviceId || "", params.userAgent || "", params.ip || ""].join("|");
    return crypto_2.default.createHash("sha256").update(raw).digest("hex");
}
async function logSuspiciousDeviceBehavior(userId, action, details) {
    await db_1.prisma.suspiciousActionLog.create({
        data: {
            userId,
            action,
            details: JSON.stringify(details),
        },
    });
}
async function authWithTelegram(initData, context) {
    const userData = parseTelegramUser(initData);
    const platformId = String(userData.id);
    const username = typeof userData.username === "string" && userData.username.trim()
        ? userData.username
        : null;
    const normalizedIp = context?.ip || "unknown";
    const normalizedDeviceId = context?.deviceId?.trim() || undefined;
    const deviceHash = computeDeviceHash({
        deviceId: normalizedDeviceId,
        userAgent: context?.userAgent,
        ip: normalizedIp,
    });
    const referralCode = `REF-${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`;
    const user = await db_1.prisma.user.upsert({
        where: { platformId },
        create: {
            platformId,
            username,
            referralCode,
            signupDeviceId: normalizedDeviceId,
            deviceHash,
            createdIp: normalizedIp,
            lastLoginIp: normalizedIp,
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
            deviceHash,
            lastLoginIp: normalizedIp,
            ...(normalizedDeviceId ? { signupDeviceId: normalizedDeviceId } : {}),
        },
    });
    const [sameDeviceAccounts, recentDeviceSwitches] = await Promise.all([
        db_1.prisma.user.count({
            where: {
                deviceHash,
                id: { not: user.id },
            },
        }),
        db_1.prisma.suspiciousActionLog.count({
            where: {
                userId: user.id,
                action: "device_switched",
                flaggedAt: {
                    gte: new Date(Date.now() - 10 * 60 * 1000),
                },
            },
        }),
    ]);
    if (sameDeviceAccounts > 0) {
        await logSuspiciousDeviceBehavior(user.id, "multi_account_same_device", {
            deviceHash,
            linkedAccounts: sameDeviceAccounts,
            ip: normalizedIp,
        });
    }
    if (user.deviceHash && user.deviceHash !== deviceHash) {
        await logSuspiciousDeviceBehavior(user.id, "device_switched", {
            previousDeviceHash: user.deviceHash,
            nextDeviceHash: deviceHash,
            ip: normalizedIp,
        });
        if (recentDeviceSwitches >= 2) {
            await logSuspiciousDeviceBehavior(user.id, "rapid_device_switching", {
                switchesInLast10Min: recentDeviceSwitches + 1,
                ip: normalizedIp,
            });
        }
    }
    return user;
}
function generateToken(userId) {
    const secret = env_1.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return jsonwebtoken_1.default.sign({ userId }, secret, { expiresIn: "7d" });
}
