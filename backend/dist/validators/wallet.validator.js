"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletAmountSchema = void 0;
const zod_1 = require("zod");
exports.walletAmountSchema = zod_1.z.object({
    amount: zod_1.z.string()
        .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
        message: "Amount must be a positive number with up to 2 decimals",
    })
        .transform((val) => val.trim())
        .refine((val) => parseFloat(val) > 0, {
        message: "Amount must be greater than zero",
    })
        .refine((val) => val.length <= 16, {
        message: "Amount too large",
    }),
    idempotencyKey: zod_1.z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();
