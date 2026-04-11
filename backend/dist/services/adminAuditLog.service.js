"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminAudit = logAdminAudit;
exports.logAdminAction = logAdminAction;
const db_1 = require("../config/db");
async function logAdminAudit({ adminId, action, targetUserId, metadata, tx, }) {
    const client = tx || db_1.prisma;
    await client.adminAuditLog.create({
        data: {
            action,
            entity: "User",
            entityId: targetUserId,
            data: {
                adminId,
                metadata: metadata || null,
            },
        },
    });
}
async function logAdminAction(action, entity, entityId, oldValues, newValues, tx) {
    await tx.adminAuditLog.create({
        data: {
            action,
            entity,
            entityId,
            data: {
                old: oldValues,
                new: newValues,
            },
        },
    });
}
