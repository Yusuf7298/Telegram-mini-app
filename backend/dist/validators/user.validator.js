"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserSchema = void 0;
const zod_1 = require("zod");
exports.registerUserSchema = zod_1.z.object({
    platformId: zod_1.z.string().min(1).max(128),
    username: zod_1.z.string().min(1).max(64).optional(),
    referrerId: zod_1.z.string().min(1).max(64).optional(),
}).strict();
