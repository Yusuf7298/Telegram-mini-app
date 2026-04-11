"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBoxController = openBoxController;
exports.freeBoxController = freeBoxController;
exports.getBoxesController = getBoxesController;
const game_service_1 = require("./game.service");
const apiResponse_1 = require("../../utils/apiResponse");
function getRequestUserId(req) {
    return req.userId;
}
async function openBoxController(req, res) {
    try {
        const { boxId, idempotencyKey } = req.body;
        const userId = getRequestUserId(req);
        if (!userId) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("userId is required"));
        }
        if (!boxId) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("boxId is required"));
        }
        if (!idempotencyKey) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("idempotencyKey is required"));
        }
        const reward = await (0, game_service_1.openBox)(userId, boxId, idempotencyKey, req.ip, req.headers["x-device-id"]);
        return res.json((0, apiResponse_1.successResponse)(reward));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(400).json((0, apiResponse_1.errorResponse)(message));
    }
}
async function freeBoxController(req, res) {
    try {
        const userId = getRequestUserId(req);
        const { idempotencyKey } = req.body;
        if (!userId) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("userId is required"));
        }
        if (!idempotencyKey) {
            return res.status(400).json((0, apiResponse_1.errorResponse)("idempotencyKey is required"));
        }
        const freeBoxResult = await (0, game_service_1.openFreeBox)(userId, idempotencyKey, req.ip, req.headers["x-device-id"]);
        return res.json((0, apiResponse_1.successResponse)(freeBoxResult));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return res.status(400).json((0, apiResponse_1.errorResponse)(message));
    }
}
async function getBoxesController(_req, res) {
    try {
        const boxes = await (0, game_service_1.getBoxes)();
        return res.json((0, apiResponse_1.successResponse)(boxes));
    }
    catch {
        return res.status(500).json((0, apiResponse_1.errorResponse)("Failed to load boxes"));
    }
}
