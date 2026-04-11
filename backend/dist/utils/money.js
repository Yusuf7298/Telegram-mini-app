"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.D = D;
exports.add = add;
exports.sub = sub;
exports.mul = mul;
exports.div = div;
exports.gt = gt;
exports.gte = gte;
exports.lt = lt;
exports.lte = lte;
exports.eq = eq;
exports.toStr = toStr;
const client_1 = require("@prisma/client");
// Create a Decimal from any value
function D(value) {
    return new client_1.Prisma.Decimal(value);
}
// Arithmetic helpers
function add(a, b) {
    return a.plus(b);
}
function sub(a, b) {
    return a.minus(b);
}
function mul(a, b) {
    return a.times(b);
}
function div(a, b) {
    return a.div(b);
}
// Comparison helpers
function gt(a, b) {
    return a.gt(b);
}
function gte(a, b) {
    return a.gte(b);
}
function lt(a, b) {
    return a.lt(b);
}
function lte(a, b) {
    return a.lte(b);
}
function eq(a, b) {
    return a.equals(b);
}
// Serializer
function toStr(decimal) {
    return decimal.toString();
}
