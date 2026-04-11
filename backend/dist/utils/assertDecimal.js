"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDecimal = assertDecimal;
exports.freezeMoneyObject = freezeMoneyObject;
const client_1 = require("@prisma/client");
function assertDecimal(value, context) {
    if (typeof value === 'number') {
        throw new Error(`[DecimalSafety] Number used for money field${context ? ` in ${context}` : ''}`);
    }
    if (!(value instanceof client_1.Prisma.Decimal)) {
        throw new Error(`[DecimalSafety] Non-Decimal value for money field${context ? ` in ${context}` : ''}`);
    }
}
// Optionally freeze Object prototype for money fields (defensive)
function freezeMoneyObject(obj) {
    if (obj && typeof obj === 'object') {
        Object.freeze(obj);
    }
}
