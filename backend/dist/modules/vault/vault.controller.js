"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimVaultController = claimVaultController;
exports.getUserVaultProgressController = getUserVaultProgressController;
const vault_service_1 = require("./vault.service");
function isValidString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
async function claimVaultController(req, res) {
    try {
        const { vaultId } = req.body;
        const userId = req.userId;
        if (!isValidString(userId) || !isValidString(vaultId)) {
            return res
                .status(400)
                .json({ success: false, error: "userId and vaultId are required" });
        }
        const reward = await (0, vault_service_1.claimVault)(userId, vaultId);
        return res.json({ success: true, data: { reward } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(400).json({ success: false, error: message });
    }
}
async function getUserVaultProgressController(req, res) {
    try {
        const userId = req.userId;
        if (!isValidString(userId)) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        const data = await (0, vault_service_1.getUserVaultProgress)(userId);
        return res.json({ success: true, data });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(500).json({ success: false, error: message });
    }
}
