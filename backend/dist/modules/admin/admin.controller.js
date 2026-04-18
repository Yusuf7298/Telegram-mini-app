"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetrics = getMetrics;
exports.getFraudEventsHandler = getFraudEventsHandler;
exports.getHighRiskUsersHandler = getHighRiskUsersHandler;
exports.verifySystemIntegrityHandler = verifySystemIntegrityHandler;
exports.verifyWalletConstraintIntegrityHandler = verifyWalletConstraintIntegrityHandler;
exports.runtimeCheckHandler = runtimeCheckHandler;
exports.createReward = createReward;
exports.updateReward = updateReward;
exports.deleteReward = deleteReward;
exports.listRewardsByBox = listRewardsByBox;
exports.freezeUserHandler = freezeUserHandler;
exports.unfreezeUserHandler = unfreezeUserHandler;
exports.revokeRewardHandler = revokeRewardHandler;
exports.freezeUser = freezeUser;
exports.revokeReward = revokeReward;
exports.updateConfig = updateConfig;
exports.getAdminConfig = getAdminConfig;
exports.listAdmins = listAdmins;
exports.createAdmin = createAdmin;
exports.removeAdmin = removeAdmin;
exports.updateReferralBonus = updateReferralBonus;
exports.getGameRewardsConfig = getGameRewardsConfig;
exports.updateGameRewardsConfig = updateGameRewardsConfig;
exports.patchAdminConfig = patchAdminConfig;
const db_1 = require("../../config/db");
const client_1 = require("@prisma/client");
const boxRewardAdmin_service_1 = require("../../services/boxRewardAdmin.service");
const admin_service_1 = require("../../services/admin.service");
const systemStats_service_1 = require("../../services/systemStats.service");
const runtimeCheck_service_1 = require("../../services/runtimeCheck.service");
const responder_1 = require("../../utils/responder");
const adminMonitoring_service_1 = require("../../services/adminMonitoring.service");
const gameConfig_service_1 = require("../../services/gameConfig.service");
function parseDecimal(value) {
    try {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        return new client_1.Prisma.Decimal(value);
    }
    catch {
        return null;
    }
}
async function getMetrics(_req, res) {
    try {
        const metrics = await (0, systemStats_service_1.getSystemMetrics)();
        return (0, responder_1.success)(res, metrics);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch metrics");
    }
}
async function getFraudEventsHandler(_req, res) {
    try {
        const events = await (0, adminMonitoring_service_1.getFraudEvents)();
        return (0, responder_1.success)(res, events);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch fraud events";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function getHighRiskUsersHandler(_req, res) {
    try {
        const users = await (0, adminMonitoring_service_1.getHighRiskUsers)();
        return (0, responder_1.success)(res, users);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch high-risk users";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function verifySystemIntegrityHandler(_req, res) {
    try {
        const result = await (0, systemStats_service_1.verifySystemIntegrity)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function verifyWalletConstraintIntegrityHandler(_req, res) {
    try {
        const result = await (0, systemStats_service_1.verifyWalletConstraintIntegrity)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function runtimeCheckHandler(_req, res) {
    try {
        const result = await (0, runtimeCheck_service_1.runRuntimeCheck)();
        return (0, responder_1.success)(res, result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Runtime check failed";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function createReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.createBoxReward)(req.body, tx);
        return (0, responder_1.success)(res, reward, 201);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function updateReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const reward = await (0, boxRewardAdmin_service_1.updateBoxReward)(String(req.params.id), req.body, tx);
        return (0, responder_1.success)(res, reward);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function deleteReward(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        await (0, boxRewardAdmin_service_1.deleteBoxReward)(String(req.params.id), tx);
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete reward";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function listRewardsByBox(req, res) {
    try {
        const tx = req.tx ?? db_1.prisma;
        const rewards = await (0, boxRewardAdmin_service_1.listBoxRewardsByBox)(String(req.params.boxId), tx);
        return (0, responder_1.success)(res, rewards);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list rewards";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function freezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        await (0, admin_service_1.freezeUser)(String(userId));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to freeze user";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function unfreezeUserHandler(req, res) {
    try {
        const userId = req.body?.targetId || req.body?.userId;
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        await (0, admin_service_1.unfreezeUser)(String(userId));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to unfreeze user";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function revokeRewardHandler(req, res) {
    try {
        const transactionId = req.body?.targetId || req.body?.transactionId;
        const reason = req.body?.reason || "admin_action";
        if (!transactionId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "transactionId is required");
        }
        await (0, admin_service_1.revokeReward)(String(transactionId), String(reason));
        return (0, responder_1.success)(res, {});
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to revoke reward";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function freezeUser(req, res) {
    return freezeUserHandler(req, res);
}
async function revokeReward(req, res) {
    return revokeRewardHandler(req, res);
}
async function updateConfig(_req, res) {
    return (0, responder_1.success)(res, {});
}
async function getAdminConfig(_req, res) {
    try {
        const config = await (0, gameConfig_service_1.getValidatedGameConfig)();
        return (0, responder_1.success)(res, { config });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch admin config";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function listAdmins(req, res) {
    try {
        const admins = await db_1.prisma.user.findMany({
            where: {
                role: {
                    in: ["ADMIN", "SUPER_ADMIN"],
                },
            },
            orderBy: [{ role: "desc" }, { createdAt: "asc" }],
            select: {
                id: true,
                platformId: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });
        return (0, responder_1.success)(res, {
            requestedBy: req.user?.role ?? null,
            admins,
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to list admins");
    }
}
async function createAdmin(req, res) {
    try {
        const userId = String(req.body?.userId || "").trim();
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const updated = await db_1.prisma.user.update({
            where: { id: userId },
            data: { role: "ADMIN" },
            select: {
                id: true,
                platformId: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });
        return (0, responder_1.success)(res, {
            message: "Admin created",
            user: updated,
        });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to create admin");
    }
}
async function removeAdmin(req, res) {
    try {
        const userId = String(req.body?.userId || "").trim();
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const target = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!target) {
            return (0, responder_1.failure)(res, "NOT_FOUND", "User not found");
        }
        if (target.role === "SUPER_ADMIN") {
            return (0, responder_1.failure)(res, "FORBIDDEN", "Cannot remove SUPER_ADMIN");
        }
        if (target.role !== "ADMIN") {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "Target user is not an admin");
        }
        const updated = await db_1.prisma.user.update({
            where: { id: userId },
            data: { role: "USER" },
            select: {
                id: true,
                platformId: true,
                username: true,
                role: true,
            },
        });
        return (0, responder_1.success)(res, {
            message: "Admin removed",
            user: updated,
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to remove admin");
    }
}
async function updateReferralBonus(req, res) {
    try {
        const referralRewardAmount = parseDecimal(req.body?.referralRewardAmount);
        if (!referralRewardAmount || referralRewardAmount.lte(0)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "referralRewardAmount must be greater than 0");
        }
        const config = await db_1.prisma.gameConfig.upsert({
            where: { id: "global" },
            create: {
                id: "global",
                referralRewardAmount,
            },
            update: {
                referralRewardAmount,
            },
            select: {
                id: true,
                referralRewardAmount: true,
            },
        });
        (0, gameConfig_service_1.invalidateGameConfigCache)();
        return (0, responder_1.success)(res, {
            message: "Referral bonus updated",
            config,
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to update referral bonus");
    }
}
async function getGameRewardsConfig(_req, res) {
    return getAdminConfig(_req, res);
}
async function updateGameRewardsConfig(req, res) {
    try {
        const currentConfig = await (0, gameConfig_service_1.getValidatedGameConfig)({ bypassCache: true });
        const referralRewardAmount = req.body?.referralRewardAmount === undefined
            ? undefined
            : parseDecimal(req.body?.referralRewardAmount);
        const freeBoxRewardAmount = req.body?.freeBoxRewardAmount === undefined
            ? undefined
            : parseDecimal(req.body?.freeBoxRewardAmount);
        const minBoxReward = req.body?.minBoxReward === undefined ? undefined : Number(req.body?.minBoxReward);
        const maxBoxReward = req.body?.maxBoxReward === undefined ? undefined : Number(req.body?.maxBoxReward);
        const waitlistBonus = req.body?.waitlistBonus === undefined ? undefined : Number(req.body?.waitlistBonus);
        if (referralRewardAmount !== undefined && (!referralRewardAmount || referralRewardAmount.lte(0))) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "referralRewardAmount must be greater than 0");
        }
        if (freeBoxRewardAmount !== undefined && (!freeBoxRewardAmount || freeBoxRewardAmount.lt(0))) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "freeBoxRewardAmount must be a non-negative number");
        }
        if (minBoxReward !== undefined && (!Number.isInteger(minBoxReward) || minBoxReward < 0)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "minBoxReward must be a non-negative integer");
        }
        if (maxBoxReward !== undefined && (!Number.isInteger(maxBoxReward) || maxBoxReward < 0)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "maxBoxReward must be a non-negative integer");
        }
        if (waitlistBonus !== undefined && (!Number.isInteger(waitlistBonus) || waitlistBonus < 0)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "waitlistBonus must be a non-negative integer");
        }
        const effectiveMinBoxReward = minBoxReward ?? currentConfig.minBoxReward;
        const effectiveMaxBoxReward = maxBoxReward ?? currentConfig.maxBoxReward;
        if (!(effectiveMinBoxReward < effectiveMaxBoxReward)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "minBoxReward must be less than maxBoxReward");
        }
        const config = await db_1.prisma.gameConfig.upsert({
            where: { id: "global" },
            create: {
                id: "global",
                ...(referralRewardAmount !== undefined ? { referralRewardAmount } : {}),
                ...(freeBoxRewardAmount !== undefined ? { freeBoxRewardAmount } : {}),
                ...(minBoxReward !== undefined ? { minBoxReward } : {}),
                ...(maxBoxReward !== undefined ? { maxBoxReward } : {}),
                ...(waitlistBonus !== undefined ? { waitlistBonus } : {}),
            },
            update: {
                ...(referralRewardAmount !== undefined ? { referralRewardAmount } : {}),
                ...(freeBoxRewardAmount !== undefined ? { freeBoxRewardAmount } : {}),
                ...(minBoxReward !== undefined ? { minBoxReward } : {}),
                ...(maxBoxReward !== undefined ? { maxBoxReward } : {}),
                ...(waitlistBonus !== undefined ? { waitlistBonus } : {}),
            },
            select: {
                id: true,
                referralRewardAmount: true,
                freeBoxRewardAmount: true,
                minBoxReward: true,
                maxBoxReward: true,
                waitlistBonus: true,
            },
        });
        (0, gameConfig_service_1.invalidateGameConfigCache)();
        return (0, responder_1.success)(res, {
            message: "Game rewards config updated",
            config,
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to update game rewards config");
    }
}
async function patchAdminConfig(req, res) {
    return updateGameRewardsConfig(req, res);
}
