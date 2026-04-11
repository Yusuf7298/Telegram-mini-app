"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIdempotencyKey = createIdempotencyKey;
exports.completeIdempotencyKey = completeIdempotencyKey;
exports.checkIdempotencyKey = checkIdempotencyKey;
// NEW: IdempotencyKey service
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
function toSerializable(value) {
    if (value instanceof client_1.Prisma.Decimal) {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map(toSerializable);
    }
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            out[key] = toSerializable(val);
        }
        return out;
    }
    return value;
}
function extractRewardAmount(response) {
    if (response instanceof client_1.Prisma.Decimal) {
        return response;
    }
    if (typeof response === "number" || typeof response === "string") {
        try {
            return new client_1.Prisma.Decimal(response);
        }
        catch {
            return new client_1.Prisma.Decimal(0);
        }
    }
    if (response && typeof response === "object") {
        const rewardLike = response.reward ?? response.amount;
        if (rewardLike !== undefined) {
            try {
                return new client_1.Prisma.Decimal(rewardLike);
            }
            catch {
                return new client_1.Prisma.Decimal(0);
            }
        }
    }
    return new client_1.Prisma.Decimal(0);
}
async function createIdempotencyKey({ id, userId, action, tx, }) {
    const client = tx || db_1.prisma;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
    const insertResult = await client.idempotencyKey.createMany({
        data: [
            {
                id,
                userId,
                boxId: "pending",
                rewardAmount: new client_1.Prisma.Decimal(0),
                action,
                status: "PENDING",
                expiresAt,
            },
        ],
        skipDuplicates: true,
    });
    if (insertResult.count === 0) {
        throw new Error("Idempotency key already exists");
    }
    return client.idempotencyKey.findUnique({ where: { id } });
}
async function completeIdempotencyKey({ id, userId, response, tx, }) {
    const client = tx || db_1.prisma;
    const rewardAmount = extractRewardAmount(response);
    const serializableResponse = toSerializable(response);
    await client.idempotencyKey.update({
        where: { id },
        data: {
            status: "COMPLETED",
            rewardAmount,
            response: serializableResponse,
            expiresAt: new Date(),
        },
    });
}
async function checkIdempotencyKey({ id, userId, tx, }) {
    const client = tx || db_1.prisma;
    const key = await client.idempotencyKey.findUnique({ where: { id } });
    if (!key)
        return null;
    if (key.userId !== userId)
        throw new Error("Idempotency key user mismatch");
    if (key.status === "PENDING" && key.expiresAt && key.expiresAt < new Date())
        throw new Error("Idempotency key expired");
    return key;
}
