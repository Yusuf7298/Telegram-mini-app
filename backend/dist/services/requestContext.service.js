"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithRequestContext = runWithRequestContext;
exports.getRequestContext = getRequestContext;
exports.getCorrelationId = getCorrelationId;
const node_async_hooks_1 = require("node:async_hooks");
const requestContextStorage = new node_async_hooks_1.AsyncLocalStorage();
function runWithRequestContext(context, callback) {
    return requestContextStorage.run(context, callback);
}
function getRequestContext() {
    return requestContextStorage.getStore() ?? null;
}
function getCorrelationId() {
    return getRequestContext()?.correlationId ?? null;
}
