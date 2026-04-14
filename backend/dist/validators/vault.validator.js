"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimVaultSchema = void 0;
const zod_1 = require("zod");
exports.claimVaultSchema = zod_1.z.object({
    vaultId: zod_1.z.string().min(1).max(64),
}).strict();
