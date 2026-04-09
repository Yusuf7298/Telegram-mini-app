"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
const db_1 = require("../../config/db");
async function createUser(platformId, username) {
    const existing = await db_1.prisma.user.findUnique({
        where: { platformId },
    });
    if (existing)
        return existing;
    return db_1.prisma.user.create({
        data: {
            platformId,
            username,
            wallet: {
                create: {},
            },
        },
    });
}
