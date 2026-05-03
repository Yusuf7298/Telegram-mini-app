"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReferralStructuredLogPayload = createReferralStructuredLogPayload;
function createReferralStructuredLogPayload(payload) {
    return {
        userId: payload.referredUserId,
        endpoint: payload.endpoint,
        action: payload.event,
        inviterId: payload.inviterId,
        referredUserId: payload.referredUserId,
        rewardAmount: payload.rewardAmount,
        status: payload.status,
        referralId: payload.referralId ?? null,
        transactionId: payload.transactionId ?? null,
        reason: payload.reason ?? null,
        detectionSource: payload.detectionSource ?? null,
        referralCode: payload.referralCode ?? null,
        ip: payload.ip ?? null,
        deviceId: payload.deviceId ?? null,
        correlationId: payload.correlationId,
        timestamp: new Date().toISOString(),
    };
}
