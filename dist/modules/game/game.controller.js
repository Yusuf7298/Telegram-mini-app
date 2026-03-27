"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBoxController = openBoxController;
exports.freeBoxController = freeBoxController;
const game_service_1 = require("./game.service");
function isValidString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
async function openBoxController(req, res) {
    try {
        const { boxId, idempotencyKey } = req.body;
        const userId = req.userId;
        if (!isValidString(userId)) {
            return res.status(400).json({
                success: false,
                error: "userId is required",
            });
        }
        if (!isValidString(boxId)) {
            return res.status(400).json({
                success: false,
                error: "boxId is required",
            });
        }
        if (!isValidString(idempotencyKey)) {
            return res.status(400).json({
                success: false,
                error: "idempotencyKey is required",
            });
        }
        const reward = await (0, game_service_1.openBox)(userId, boxId, idempotencyKey);
        return res.json({
            success: true,
            data: { reward },
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(400).json({
            success: false,
            error: message,
        });
    }
}
async function freeBoxController(req, res) {
    try {
        const userId = req.userId;
        if (!isValidString(userId)) {
            return res.status(400).json({
                success: false,
                error: "userId is required",
            });
        }
        const reward = await (0, game_service_1.openFreeBox)(userId);
        return res.json({
            success: true,
            data: { reward },
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(400).json({
            success: false,
            error: message,
        });
    }
}
