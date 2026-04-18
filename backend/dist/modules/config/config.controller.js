"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameConfig = getGameConfig;
const gameConfig_service_1 = require("../../services/gameConfig.service");
const responder_1 = require("../../utils/responder");
async function getGameConfig(_req, res) {
    try {
        const config = await (0, gameConfig_service_1.getValidatedGameConfig)();
        return (0, responder_1.success)(res, config);
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to fetch game config");
    }
}
