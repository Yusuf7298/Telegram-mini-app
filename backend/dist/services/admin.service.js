"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezeUser = freezeUser;
exports.unfreezeUser = unfreezeUser;
exports.revokeReward = revokeReward;
const assertDecimal_1 = require("../utils/assertDecimal");
// NEW: Admin controls for freeze/unfreeze/revokeReward
const db_1 = require("../config/db");
const auditLog_service_1 = require("./auditLog.service");
async function freezeUser(userId, tx) {
    const client = tx || db_1.prisma;
    await client.user.update({ where: { id: userId }, data: { isFrozen: true } });
    await (0, auditLog_service_1.logAudit)({ userId, action: "freezeUser", details: {}, tx: client });
}
async function unfreezeUser(userId, tx) {
    const client = tx || db_1.prisma;
    await client.user.update({ where: { id: userId }, data: { isFrozen: false } });
    await (0, auditLog_service_1.logAudit)({ userId, action: "unfreezeUser", details: {}, tx: client });
}
async function revokeReward(transactionId, reason, tx) {
    const client = tx || db_1.prisma;
    const txn = await client.transaction.findUnique({ where: { id: transactionId } });
    if (!txn)
        throw new Error("Transaction not found");
    // UPDATED: Only allow revoking rewards, not purchases
    if (txn.type !== "BOX_REWARD" && txn.type !== "REFERRAL" && txn.type !== "VAULT_REWARD" && txn.type !== "WELCOME_BONUS") {
        throw new Error("Can only revoke reward transactions");
    }
    // UPDATED: Reverse wallet update safely
    (0, assertDecimal_1.assertDecimal)(txn.amount, 'admin.revokeReward.amount');
    await client.wallet.update({
        where: { userId: txn.userId },
        data: { cashBalance: { decrement: txn.amount } },
    });
    await client.rewardRevocation.create({
        data: { userId: txn.userId, rewardId: transactionId, reason },
    });
    await (0, auditLog_service_1.logAudit)({ userId: txn.userId, action: "revokeReward", details: { transactionId, reason }, tx: client });
}
