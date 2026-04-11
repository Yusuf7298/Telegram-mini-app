"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const suspiciousActionLog_service_1 = require("./suspiciousActionLog.service");
const auditLog_service_1 = require("./auditLog.service");
class AlertService {
    // Log and trigger alert for rapid box opens
    static async rapidBoxOpens(userId, count) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "rapid_box_opens", metadata: { count } });
        await (0, auditLog_service_1.logAudit)({ userId, action: "alert_rapid_box_opens", details: { count } });
        // Future: sendSlack, sendEmail, sendWebhook
    }
    // Log and trigger alert for wallet anomalies
    static async walletAnomaly(userId, change) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "wallet_anomaly", metadata: { change } });
        await (0, auditLog_service_1.logAudit)({ userId, action: "alert_wallet_anomaly", details: { change } });
        // Future: sendSlack, sendEmail, sendWebhook
    }
    // Log and trigger alert for admin actions
    static async adminAction(adminId, action, details) {
        await (0, auditLog_service_1.logAudit)({ userId: adminId, action: `admin_${action}`, details });
        // Future: sendSlack, sendEmail, sendWebhook
    }
    // Log and trigger alert for failed Telegram auth
    static async failedTelegramAuth(userId, ip, attempts) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId: userId || "unknown", type: "failed_telegram_auth", metadata: { ip, attempts } });
        await (0, auditLog_service_1.logAudit)({ userId: userId || "unknown", action: "alert_failed_telegram_auth", details: { ip, attempts } });
        // Future: sendSlack, sendEmail, sendWebhook
    }
    // Log and trigger alert for referral farming
    static async referralFarming(userId, count) {
        await (0, suspiciousActionLog_service_1.logSuspiciousAction)({ userId, type: "referral_farming", metadata: { count } });
        await (0, auditLog_service_1.logAudit)({ userId, action: "alert_referral_farming", details: { count } });
        // Future: sendSlack, sendEmail, sendWebhook
    }
    // Log and trigger alert for repeated wins anomaly
    static async repeatedWins(userId, winCount, total) {
        await (0, auditLog_service_1.logAudit)({ userId, action: "alert_repeated_wins", details: { winCount, total } });
        // Future: sendSlack, sendEmail, sendWebhook
    }
}
exports.AlertService = AlertService;
