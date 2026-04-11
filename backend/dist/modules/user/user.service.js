"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
const db_1 = require("../../config/db");
const crypto_1 = require("crypto");
async function createUser(platformId, username) {
    const existing = await db_1.prisma.user.findUnique({
        where: { platformId },
    });
    if (existing)
        return existing;
    // Welcome bonus: set bonusBalance=1000, bonusLocked=true
    return db_1.prisma.user.create({
        data: {
            platformId,
            username,
            referralCode: `REF-${(0, crypto_1.randomUUID)().replace(/-/g, "").slice(0, 12)}`,
            waitlistBonusGranted: true,
            waitlistBonusUnlocked: false,
            totalPlaysCount: 0,
            wallet: {
                create: {
                    bonusBalance: 1000,
                    bonusLocked: true,
                },
            },
        },
    });
}
