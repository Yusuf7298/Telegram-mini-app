"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIdempotencyKey = createIdempotencyKey;
exports.completeIdempotencyKey = completeIdempotencyKey;
exports.checkIdempotencyKey = checkIdempotencyKey;
// NEW: IdempotencyKey service
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
function toDecimalString(value) {
    try {
        return new client_1.Prisma.Decimal(value ?? 0).toString();
    }
    catch {
        return new client_1.Prisma.Decimal(0).toString();
    }
}
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
function isSuccessEnvelope(response) {
    return Boolean(response &&
        typeof response === "object" &&
        response.success === true &&
        Object.prototype.hasOwnProperty.call(response, "data") &&
        response.error === null);
}
function toSuccessEnvelope(response) {
    if (isSuccessEnvelope(response)) {
        return {
            success: true,
            data: toSerializable(response.data),
            error: null,
        };
    }
    return {
        success: true,
        data: toSerializable(response),
        error: null,
    };
}
function normalizeIdempotencyResponse(response, metadata) {
    const envelope = toSuccessEnvelope(response);
    if (!metadata || Object.keys(metadata).length === 0) {
        return envelope;
    }
    const data = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
        ? { ...envelope.data }
        : { value: envelope.data };
    return {
        success: true,
        data: {
            ...data,
            metadata: {
                ...(typeof data.metadata === "object" && data.metadata ? data.metadata : {}),
                ...toSerializable(metadata),
            },
        },
        error: null,
    };
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
    await (0, logger_1.logStructuredEvent)("idempotency_created", {
        userId,
        endpoint: action,
        idempotencyKey: id,
        action,
        timestamp: new Date().toISOString(),
    });
    return client.idempotencyKey.findUnique({ where: { id } });
}
async function completeIdempotencyKey({ id, userId, response, metadata, tx, }) {
    const client = tx || db_1.prisma;
    const existingKey = await client.idempotencyKey.findUnique({ where: { id } });
    if (!existingKey) {
        throw new Error("Idempotency key not found");
    }
    if (existingKey.userId !== userId) {
        throw new Error("Idempotency key user mismatch");
    }
    const rewardAmount = extractRewardAmount(response);
    const normalizedResponse = normalizeIdempotencyResponse(response, metadata);
    await client.idempotencyKey.update({
        where: { id },
        data: {
            status: "COMPLETED",
            rewardAmount,
            response: normalizedResponse,
            expiresAt: new Date(),
        },
    });
    return normalizedResponse;
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
    if (key.status === "COMPLETED") {
        await (0, logger_1.logStructuredEvent)("idempotency_hit", {
            userId,
            endpoint: key.action,
            idempotencyKey: id,
            action: key.action,
            timestamp: new Date().toISOString(),
        });
        return {
            ...key,
            response: normalizeIdempotencyResponse(key.response),
        };
    }
    return key;
}
