"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalSerializer = decimalSerializer;
const client_1 = require("@prisma/client");
function serializeDecimals(obj) {
    if (obj instanceof client_1.Prisma.Decimal) {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeDecimals);
    }
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = serializeDecimals(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
function decimalSerializer(req, res, next) {
    const originalJson = res.json;
    res.json = function (data) {
        const serialized = serializeDecimals(data);
        return originalJson.call(this, serialized);
    };
    next();
}
