"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logJackpotSkip = logJackpotSkip;
exports.logStructuredEvent = logStructuredEvent;
exports.logError = logError;
async function logJackpotSkip(details) {
    setImmediate(() => {
        // Replace with your logger or external service
        console.warn('[JackpotSkip]', JSON.stringify(details));
    });
}
async function logStructuredEvent(event, fields) {
    setImmediate(() => {
        console.info(JSON.stringify({ event, ...fields }));
    });
}
async function logError(error, context) {
    setImmediate(() => {
        console.error('[Error]', error.message, context ? JSON.stringify(context) : '');
    });
}
