"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openBoxController = openBoxController;
exports.freeBoxController = freeBoxController;
exports.getBoxesController = getBoxesController;
const game_service_1 = require("./game.service");
const responder_1 = require("../../utils/responder");
const idempotencyKey_1 = require("../../utils/idempotencyKey");
function getRequestUserId(req) {
    return req.userId;
}
async function openBoxController(req, res) {
    try {
        const { boxId } = req.body;
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        const userId = getRequestUserId(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        if (!boxId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "boxId is required");
        }
        if (!idempotencyKey) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "idempotencyKey is required");
        }
        const replaySafeResponse = await (0, game_service_1.openBox)(userId, boxId, idempotencyKey, req.ip, req.headers["x-device-id"]);
        return (0, responder_1.success)(res, replaySafeResponse.data);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function freeBoxController(req, res) {
    try {
        const userId = getRequestUserId(req);
        const idempotencyKey = (0, idempotencyKey_1.extractIdempotencyKey)(req);
        if (!userId) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "userId is required");
        }
        if (!idempotencyKey) {
            return (0, responder_1.failure)(res, "INVALID_INPUT", "idempotencyKey is required");
        }
        const freeBoxResult = await (0, game_service_1.openFreeBox)(userId, idempotencyKey, req.ip, req.headers["x-device-id"]);
        return (0, responder_1.success)(res, freeBoxResult.data);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", message);
    }
}
async function getBoxesController(_req, res) {
    try {
        const boxes = await (0, game_service_1.getBoxes)();
        return (0, responder_1.success)(res, boxes);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to load boxes");
    }
}
