"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = getWallet;
const db_1 = require("../../config/db");
async function getWallet(req, res) {
    try {
        const userId = req.userId;
        if (typeof userId !== "string" || !userId.trim()) {
            return res.status(400).json({ success: false, error: "userId is required" });
        }
        const wallet = await db_1.prisma.wallet.findUnique({
            where: { userId },
        });
        if (!wallet) {
            return res.status(404).json({ success: false, error: "Wallet not found" });
        }
        return res.json({ success: true, data: wallet });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: "Failed to fetch wallet" });
    }
}
