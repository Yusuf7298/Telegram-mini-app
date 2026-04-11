"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralCodeSchema = void 0;
const zod_1 = require("zod");
exports.referralCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(4).max(16).regex(/^[A-Z0-9]+$/i),
}).strict();
