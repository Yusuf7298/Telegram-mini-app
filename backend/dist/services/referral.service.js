"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logReferral = logReferral;
exports.checkReferralLimits = checkReferralLimits;
// NEW: Referral protection service
const db_1 = require("../config/db");
const MAX_REFERRALS_PER_IP_PER_DAY = 5;
async function logReferral({ referrerId, referredId, ip, deviceId, suspicious, tx, }) {
    const client = tx || db_1.prisma;
    await client.referralLog.create({
        data: { referrerId, referredId, ip, deviceId, suspicious: !!suspicious },
    });
}
async function checkReferralLimits({ ip, deviceId, referrerId, referredId, tx, }) {
    const client = tx || db_1.prisma;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const countByIp = await client.referralLog.count({
        where: {
            ip,
            createdAt: { gte: since },
        },
    });
    if (countByIp >= MAX_REFERRALS_PER_IP_PER_DAY) {
        return false;
    }
    if (referrerId && referredId) {
        const [referrer, referred] = await Promise.all([
            client.user.findUnique({ where: { id: referrerId }, select: { deviceHash: true, createdIp: true } }),
            client.user.findUnique({ where: { id: referredId }, select: { deviceHash: true, createdIp: true } }),
        ]);
        if (!referrer || !referred)
            return false;
        if (referrer.createdIp === referred.createdIp)
            return false;
        if (referrer.deviceHash && referred.deviceHash && referrer.deviceHash === referred.deviceHash) {
            return false;
        }
    }
    if (deviceId) {
        const countByDevice = await client.referralLog.count({
            where: {
                deviceId,
                createdAt: { gte: since },
            },
        });
        if (countByDevice >= MAX_REFERRALS_PER_IP_PER_DAY) {
            return false;
        }
    }
    return true;
}
