"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
// NEW: AuditLog service
const db_1 = require("../config/db");
async function logAudit({ userId, action, details, tx, }) {
    const client = tx || db_1.prisma;
    await client.auditLog.create({
        data: {
            userId,
            action,
            details: details ? JSON.stringify(details) : undefined,
        },
    });
}
