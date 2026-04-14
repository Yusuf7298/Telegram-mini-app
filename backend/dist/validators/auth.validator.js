"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramLoginSchema = void 0;
const zod_1 = require("zod");
exports.telegramLoginSchema = zod_1.z.object({
    initData: zod_1.z.string().min(1),
}).strict();
