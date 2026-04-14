"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFraudEvents = getFraudEvents;
exports.getHighRiskUsers = getHighRiskUsers;
const db_1 = require("../config/db");
function toDecimalString(value) {
    if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
        return value.toString();
    }
    return String(value ?? "0");
}
async function getFraudEvents() {
    const events = await db_1.prisma.suspiciousActionLog.findMany({
        orderBy: { flaggedAt: "desc" },
        take: 100,
        include: {
            user: {
                select: {
                    id: true,
                    platformId: true,
                    username: true,
                    riskScore: true,
                    accountStatus: true,
                },
            },
        },
    });
    return events.map((event) => ({
        id: event.id,
        userId: event.userId,
        user: event.user
            ? {
                id: event.user.id,
                platformId: event.user.platformId,
                username: event.user.username,
                riskScore: event.user.riskScore,
                accountStatus: event.user.accountStatus,
            }
            : null,
        action: event.action,
        details: event.details,
        flaggedAt: event.flaggedAt.toISOString(),
        reviewed: event.reviewed,
    }));
}
async function getHighRiskUsers() {
    const users = await db_1.prisma.user.findMany({
        where: {
            riskScore: {
                gt: 0,
            },
        },
        orderBy: [
            { riskScore: "desc" },
            { createdAt: "desc" },
        ],
        include: {
            wallet: true,
        },
    });
    return users.map((user) => ({
        id: user.id,
        platformId: user.platformId,
        username: user.username,
        riskScore: user.riskScore,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt.toISOString(),
        wallet: user.wallet
            ? {
                cashBalance: toDecimalString(user.wallet.cashBalance),
                bonusBalance: toDecimalString(user.wallet.bonusBalance),
                bonusLocked: user.wallet.bonusLocked,
            }
            : null,
    }));
}
