"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freeBoxSchema = exports.openBoxSchema = void 0;
const zod_1 = require("zod");
exports.openBoxSchema = zod_1.z.object({
    boxId: zod_1.z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    idempotencyKey: zod_1.z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    timestamp: zod_1.z.number().int().positive(),
}).strict();
exports.freeBoxSchema = zod_1.z.object({
    idempotencyKey: zod_1.z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    timestamp: zod_1.z.number().int().positive(),
}).strict();
