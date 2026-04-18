"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGameRewardsConfigSchema = exports.adminConfigPatchSchema = exports.adminReferralBonusSchema = exports.adminCreateRemoveSchema = exports.adminConfigUpdateSchema = exports.adminRevokeSchema = exports.adminFreezeUserSchema = exports.adminRewardSchema = exports.adminActionSchema = void 0;
const zod_1 = require("zod");
exports.adminActionSchema = zod_1.z.object({
    action: zod_1.z.string().min(3).max(32),
    targetId: zod_1.z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
    reason: zod_1.z.string().min(3).max(256).optional(),
}).strict();
exports.adminRewardSchema = zod_1.z.object({
    boxId: zod_1.z.string().min(1).max(64),
    reward: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    weight: zod_1.z.number().int().positive(),
    category: zod_1.z.string().max(64).optional(),
    label: zod_1.z.string().max(128).optional(),
    isJackpot: zod_1.z.boolean().optional(),
    maxWinners: zod_1.z.number().int().positive().optional(),
    currentWinners: zod_1.z.number().int().nonnegative().optional(),
}).strict();
exports.adminFreezeUserSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1).max(64).optional(),
    targetId: zod_1.z.string().min(1).max(64).optional(),
    reason: zod_1.z.string().min(3).max(256).optional(),
}).refine((v) => Boolean(v.userId || v.targetId), {
    message: "userId or targetId is required",
});
exports.adminRevokeSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1).max(64).optional(),
    targetId: zod_1.z.string().min(1).max(64).optional(),
    reason: zod_1.z.string().min(3).max(256).optional(),
}).refine((v) => Boolean(v.transactionId || v.targetId), {
    message: "transactionId or targetId is required",
});
exports.adminConfigUpdateSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
exports.adminCreateRemoveSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1).max(64),
}).strict();
exports.adminReferralBonusSchema = zod_1.z.object({
    referralRewardAmount: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
}).strict();
const adminRewardConfigFields = {
    referralRewardAmount: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    freeBoxRewardAmount: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    minBoxReward: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    maxBoxReward: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    waitlistBonus: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
};
exports.adminConfigPatchSchema = zod_1.z.object(adminRewardConfigFields).strict().refine((value) => value.referralRewardAmount !== undefined ||
    value.freeBoxRewardAmount !== undefined ||
    value.minBoxReward !== undefined ||
    value.maxBoxReward !== undefined ||
    value.waitlistBonus !== undefined, {
    message: "At least one reward amount is required",
});
exports.adminGameRewardsConfigSchema = exports.adminConfigPatchSchema;
