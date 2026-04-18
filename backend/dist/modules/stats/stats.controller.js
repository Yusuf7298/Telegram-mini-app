"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopWinnersHandler = getTopWinnersHandler;
const responder_1 = require("../../utils/responder");
const stats_service_1 = require("./stats.service");
function parseLimit(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
}
async function getTopWinnersHandler(req, res) {
    try {
        const winners = await (0, stats_service_1.getTopWinners)(parseLimit(req.query.limit));
        return (0, responder_1.success)(res, {
            winners,
            refreshedAt: new Date().toISOString(),
        });
    }
    catch {
        return (0, responder_1.failure)(res, "INTERNAL_ERROR", "Failed to load top winners");
    }
}
