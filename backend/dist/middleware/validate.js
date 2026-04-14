"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
const apiResponse_1 = require("../utils/apiResponse");
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Validation error"));
        }
        req.body = result.data;
        next();
    };
}
function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return res.status((0, apiResponse_1.getErrorStatus)("INVALID_INPUT")).json((0, apiResponse_1.structuredError)("INVALID_INPUT", "Validation error"));
        }
        req.query = result.data;
        next();
    };
}
