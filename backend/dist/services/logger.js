"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logJackpotSkip = logJackpotSkip;
exports.logStructuredEvent = logStructuredEvent;
exports.logDebug = logDebug;
exports.logError = logError;
const env_1 = require("../config/env");
function toRequiredContext(fields, fallbackAction) {
    const userId = typeof fields.userId === "string" && fields.userId.trim() ? fields.userId : "unknown";
    const endpoint = typeof fields.endpoint === "string" && fields.endpoint.trim() ? fields.endpoint : "unknown";
    const action = typeof fields.action === "string" && fields.action.trim() ? fields.action : fallbackAction;
    return {
        userId,
        endpoint,
        action,
    };
}
function writeLog(level, payload) {
    if (level === "debug" && env_1.env.NODE_ENV === "production") {
        return;
    }
    const message = JSON.stringify({
        level,
        timestamp: new Date().toISOString(),
        ...payload,
    });
    if (level === "debug") {
        console.debug(message);
        return;
    }
    if (level === "error") {
        console.error(message);
        return;
    }
    if (level === "warn") {
        console.warn(message);
        return;
    }
    console.info(message);
}
async function logJackpotSkip(details) {
    const fields = (details || {});
    const context = toRequiredContext(fields, "jackpot_skip");
    setImmediate(() => {
        writeLog("warn", {
            event: "jackpot_skip",
            ...context,
            ...fields,
        });
    });
}
async function logStructuredEvent(event, fields) {
    const logFields = (fields || {});
    const context = toRequiredContext(logFields, event || "unknown_action");
    setImmediate(() => {
        writeLog("info", {
            event,
            ...context,
            ...logFields,
        });
    });
}
async function logDebug(event, fields = {}) {
    const logFields = (fields || {});
    const context = toRequiredContext(logFields, event || "debug");
    setImmediate(() => {
        writeLog("debug", {
            event,
            ...context,
            ...logFields,
        });
    });
}
async function logError(error, context) {
    const fields = (context || {});
    const contextFields = toRequiredContext(fields, "error");
    setImmediate(() => {
        writeLog("error", {
            event: "error",
            ...contextFields,
            errorName: error.name,
            errorMessage: error.message,
            ...fields,
        });
    });
}
