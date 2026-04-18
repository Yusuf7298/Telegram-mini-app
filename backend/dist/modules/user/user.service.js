"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
exports.createUser = createUser;
const db_1 = require("../../config/db");
const client_1 = require("@prisma/client");
const gameConfig_service_1 = require("../../services/gameConfig.service");
const REFERRAL_CODE_MIN_LENGTH = 6;
const REFERRAL_CODE_MAX_LENGTH = 8;
const DEFAULT_REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_REFERRAL_CODE_ATTEMPTS = 25;
function generateReferralCode(length = DEFAULT_REFERRAL_CODE_LENGTH) {
    if (length < REFERRAL_CODE_MIN_LENGTH || length > REFERRAL_CODE_MAX_LENGTH) {
        throw new Error(`Referral code length must be between ${REFERRAL_CODE_MIN_LENGTH} and ${REFERRAL_CODE_MAX_LENGTH}`);
    }
    let code = "";
    for (let i = 0; i < length; i += 1) {
        const index = Math.floor(Math.random() * REFERRAL_CODE_CHARSET.length);
        code += REFERRAL_CODE_CHARSET[index];
    }
    return code;
}
function isReferralCodeUniqueConstraintError(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError)) {
        return false;
    }
    if (error.code !== "P2002") {
        return false;
    }
    const target = error.meta?.target;
    if (Array.isArray(target)) {
        return target.includes("referralCode");
    }
    return typeof target === "string" && target.includes("referralCode");
}
async function createUser(telegramId, username, options) {
    const existing = await db_1.prisma.user.findUnique({
        where: { telegramId },
    });
    if (existing)
        return existing;
    const config = await (0, gameConfig_service_1.getValidatedGameConfig)();
    for (let attempt = 1; attempt <= MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
        const referralCode = generateReferralCode();
        const referralCodeInUse = await db_1.prisma.user.findUnique({
            where: { referralCode },
            select: { id: true },
        });
        if (referralCodeInUse) {
            continue;
        }
        try {
            // Welcome bonus: set bonusBalance and lock it for progression rules.
            return await db_1.prisma.user.create({
                data: {
                    telegramId,
                    // Keep legacy column mirrored to avoid regressions while moving to telegramId everywhere.
                    platformId: telegramId,
                    username: username ?? undefined,
                    firstName: options?.firstName ?? undefined,
                    lastName: options?.lastName ?? undefined,
                    profilePhotoUrl: options?.profilePhotoUrl ?? undefined,
                    referralCode,
                    signupDeviceId: options?.signupDeviceId,
                    deviceHash: options?.deviceHash,
                    createdIp: options?.createdIp,
                    lastLoginIp: options?.lastLoginIp,
                    waitlistBonusGranted: true,
                    waitlistBonusUnlocked: false,
                    totalPlaysCount: 0,
                    wallet: {
                        create: {
                            bonusBalance: config.waitlistBonus,
                            bonusLocked: true,
                        },
                    },
                },
            });
        }
        catch (error) {
            if (isReferralCodeUniqueConstraintError(error)) {
                continue;
            }
            throw error;
        }
    }
    throw new Error("Failed to generate a unique referral code after multiple attempts");
}
