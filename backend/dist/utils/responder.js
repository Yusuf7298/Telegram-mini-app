"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.failure = failure;
const apiResponse_1 = require("./apiResponse");
function success(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
        error: null,
    });
}
function failure(res, code, message) {
    return res.status((0, apiResponse_1.getErrorStatus)(code)).json((0, apiResponse_1.structuredError)(code, message));
}
