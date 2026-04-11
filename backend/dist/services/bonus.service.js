"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackBonusUsage = trackBonusUsage;
const assertDecimal_1 = require("../utils/assertDecimal");
// NEW: Bonus usage tracking service
const db_1 = require("../config/db");
async function trackBonusUsage({ userId, bonusType, amount, tx, }) {
    const client = tx || db_1.prisma;
    (0, assertDecimal_1.assertDecimal)(amount, 'bonus.amount');
    await client.bonusUsage.create({
        data: { userId, bonusType, amount },
    });
}
