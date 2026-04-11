"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRTP = calculateRTP;
exports.adjustRewardProbabilities = adjustRewardProbabilities;
const db_1 = require("../config/db");
const money_1 = require("../utils/money");
const TARGET_RTP = (0, money_1.D)(75);
const ALLOWED_DEVIATION = (0, money_1.D)(5); // percent
// Calculate RTP as totalOut / totalIn * 100 (Decimal math)
async function calculateRTP() {
    const stats = await db_1.prisma.systemStats.findUnique({ where: { id: "global" } });
    if (!stats)
        throw new Error("SystemStats not found");
    const totalIn = (0, money_1.D)(stats.totalIn);
    const totalOut = (0, money_1.D)(stats.totalOut);
    if (totalIn.isZero())
        return (0, money_1.D)(0);
    const rtp = totalOut.div(totalIn).mul((0, money_1.D)(100)).toDecimalPlaces(2);
    return rtp;
}
// Adjust reward probabilities if RTP deviates >5% from target
async function adjustRewardProbabilities(adminOverride = false) {
    const rtp = await calculateRTP();
    const diff = rtp.minus(TARGET_RTP).abs();
    if (diff.lte(ALLOWED_DEVIATION) && !adminOverride) {
        return { adjusted: false, rtp: rtp.toString(), message: "RTP within allowed range" };
    }
    // Fetch all BoxRewards
    const rewards = await db_1.prisma.boxReward.findMany();
    // Compute adjustment factor
    let factor = (0, money_1.D)(1);
    if (rtp.lt(TARGET_RTP)) {
        // RTP too low: increase reward weights
        factor = TARGET_RTP.div(rtp);
    }
    else if (rtp.gt(TARGET_RTP)) {
        // RTP too high: decrease reward weights
        factor = TARGET_RTP.div(rtp);
    }
    // Clamp factor to avoid extreme changes
    if (factor.lt((0, money_1.D)(0.8)))
        factor = (0, money_1.D)(0.8);
    if (factor.gt((0, money_1.D)(1.2)))
        factor = (0, money_1.D)(1.2);
    // Adjust all non-jackpot weights
    for (const reward of rewards) {
        if (!reward.isJackpot) {
            const newWeight = (0, money_1.D)(reward.weight).mul(factor).toDecimalPlaces(0, 1).toNumber();
            await db_1.prisma.boxReward.update({ where: { id: reward.id }, data: { weight: newWeight } });
        }
    }
    // Log adjustment
    await db_1.prisma.adminAuditLog.create({
        data: {
            action: "adjust_rtp",
            entity: "BoxReward",
            data: { prevRTP: rtp.toString(), targetRTP: TARGET_RTP.toString(), factor: factor.toString() },
        },
    });
    return { adjusted: true, rtp: rtp.toString(), factor: factor.toString() };
}
