"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimVaultController = claimVaultController;
exports.getUserVaultProgressController = getUserVaultProgressController;
const vault_service_1 = require("./vault.service");
const responder_1 = require("../../utils/responder");
function isValidString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function getRequestUserId(req) {
    return req.userId;
}
async function claimVaultController(req, res) {
    try {
        const { vaultId } = req.body;
        const userId = getRequestUserId(req);
        if (!isValidString(userId) || !isValidString(vaultId)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId and vaultId are required");
        }
        const reward = await (0, vault_service_1.claimVault)(userId, vaultId);
        return (0, responder_1.success)(res, { reward });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return (0, responder_1.failure)(res, "INVALID_INPUT", message);
    }
}
async function getUserVaultProgressController(req, res) {
    try {
        const userId = getRequestUserId(req);
        if (!isValidString(userId)) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        const data = await (0, vault_service_1.getUserVaultProgress)(userId);
        return (0, responder_1.success)(res, data);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
