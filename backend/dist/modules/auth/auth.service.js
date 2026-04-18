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
const crypto_1 = __importDefault(require("crypto"));
const user_service_1 = require("../user/user.service");
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
    return crypto_1.default.createHash("sha256").update(raw).digest("hex");
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
    const telegramId = String(userData.id);
    const username = typeof userData.username === "string" && userData.username.trim()
        ? userData.username
        : null;
    const firstName = typeof userData.first_name === "string" && userData.first_name.trim()
        ? userData.first_name.trim()
        : null;
    const lastName = typeof userData.last_name === "string" && userData.last_name.trim()
        ? userData.last_name.trim()
        : null;
    const profilePhotoUrl = typeof userData.photo_url === "string" && userData.photo_url.trim()
        ? userData.photo_url.trim()
        : null;
    const normalizedIp = context?.ip || "unknown";
    const normalizedDeviceId = context?.deviceId?.trim() || undefined;
    const deviceHash = computeDeviceHash({
        deviceId: normalizedDeviceId,
        userAgent: context?.userAgent,
        ip: normalizedIp,
    });
    const existingUser = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    const user = existingUser
        ? await db_1.prisma.user.update({
            where: { telegramId },
            data: {
                username,
                firstName,
                lastName,
                profilePhotoUrl,
                platformId: telegramId,
                deviceHash,
                lastLoginIp: normalizedIp,
                ...(normalizedDeviceId ? { signupDeviceId: normalizedDeviceId } : {}),
            },
        })
        : await (0, user_service_1.createUser)(telegramId, username, {
            firstName,
            lastName,
            profilePhotoUrl,
            signupDeviceId: normalizedDeviceId,
            deviceHash,
            createdIp: normalizedIp,
            lastLoginIp: normalizedIp,
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
function generateToken(userId, role) {
    const secret = env_1.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return jsonwebtoken_1.default.sign({ userId, role }, secret, { expiresIn: "7d" });
}
