"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRTP = calculateRTP;
exports.incrementBoxesOpened = incrementBoxesOpened;
exports.incrementJackpotWins = incrementJackpotWins;
exports.getSystemMetrics = getSystemMetrics;
exports.verifySystemIntegrity = verifySystemIntegrity;
exports.checkStatsIntegrity = checkStatsIntegrity;
const db_1 = require("../config/db");
const money_1 = require("../utils/money");
function calculateRTP(totalIn, totalOut) {
    const inValue = (0, money_1.D)(totalIn);
    const outValue = (0, money_1.D)(totalOut);
    if (inValue.lte(0))
        return (0, money_1.D)(0);
    return outValue.div(inValue).mul((0, money_1.D)(100)).toDecimalPlaces(2);
}
async function incrementBoxesOpened(tx) {
    const client = tx || db_1.prisma;
    await client.systemStats.upsert({
        where: { id: "global" },
        update: { totalBoxesOpened: { increment: 1 } },
        create: {
            id: "global",
            totalIn: (0, money_1.D)(0),
            totalOut: (0, money_1.D)(0),
            totalBoxesOpened: 1,
            jackpotWins: 0,
        },
    });
}
async function incrementJackpotWins(tx) {
    const client = tx || db_1.prisma;
    await client.systemStats.upsert({
        where: { id: "global" },
        update: { jackpotWins: { increment: 1 } },
        create: {
            id: "global",
            totalIn: (0, money_1.D)(0),
            totalOut: (0, money_1.D)(0),
            totalBoxesOpened: 0,
            jackpotWins: 1,
        },
    });
}
async function getSystemMetrics() {
    const stats = await db_1.prisma.systemStats.findUnique({ where: { id: "global" } });
    const totalIn = stats?.totalIn ?? (0, money_1.D)(0);
    const totalOut = stats?.totalOut ?? (0, money_1.D)(0);
    return {
        totalIn: totalIn.toString(),
        totalOut: totalOut.toString(),
        rtp: calculateRTP(totalIn, totalOut).toString(),
        totalBoxesOpened: stats?.totalBoxesOpened ?? 0,
        jackpotWins: stats?.jackpotWins ?? 0,
    };
}
async function verifySystemIntegrity() {
    const issues = [];
    const wallets = await db_1.prisma.wallet.findMany();
    const negativeWallets = wallets.filter((wallet) => wallet.cashBalance.lt(0) || wallet.bonusBalance.lt(0));
    if (negativeWallets.length > 0) {
        issues.push(`Negative wallet balances found for userIds: ${negativeWallets.map((wallet) => wallet.userId).join(", ")}`);
    }
    const metrics = await getSystemMetrics();
    const rtp = Number(metrics.rtp);
    if (Number.isFinite(rtp) && (rtp < 0 || rtp > 100)) {
        issues.push(`RTP out of range: ${metrics.rtp}%`);
    }
    return {
        valid: issues.length === 0,
        issues,
    };
}
async function checkStatsIntegrity() {
    return verifySystemIntegrity();
}
