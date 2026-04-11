"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminActionSchema = void 0;
const zod_1 = require("zod");
exports.adminActionSchema = zod_1.z.object({
    action: zod_1.z.string().min(3).max(32),
    targetId: zod_1.z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    reason: zod_1.z.string().min(3).max(256).optional(),
}).strict();
