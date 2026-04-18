"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramLoginSchema = void 0;
const zod_1 = require("zod");
exports.telegramLoginSchema = zod_1.z.object({
    initData: zod_1.z.string().min(1),
    referralCode: zod_1.z.string().min(6).max(8).regex(/^[A-Z0-9]+$/i).optional(),
}).strict();
