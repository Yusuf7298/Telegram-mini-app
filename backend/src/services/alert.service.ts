import { prisma } from "../config/db";
import { logSuspiciousAction } from "./suspiciousActionLog.service";
import { logAudit } from "./auditLog.service";

export class AlertService {
  // Log and trigger alert for rapid box opens
  static async rapidBoxOpens(userId: string, count: number) {
    await logSuspiciousAction({ userId, type: "rapid_box_opens", metadata: { count } });
    await logAudit({ userId, action: "alert_rapid_box_opens", details: { count } });
    // Future: sendSlack, sendEmail, sendWebhook
  }

  // Log and trigger alert for wallet anomalies
  static async walletAnomaly(userId: string, change: number) {
    await logSuspiciousAction({ userId, type: "wallet_anomaly", metadata: { change } });
    await logAudit({ userId, action: "alert_wallet_anomaly", details: { change } });
    // Future: sendSlack, sendEmail, sendWebhook
  }

  // Log and trigger alert for admin actions
  static async adminAction(adminId: string, action: string, details?: object) {
    await logAudit({ userId: adminId, action: `admin_${action}`, details });
    // Future: sendSlack, sendEmail, sendWebhook
  }

  // Log and trigger alert for failed Telegram auth
  static async failedTelegramAuth(userId: string | null, ip: string, attempts: number) {
    await logSuspiciousAction({ userId: userId || "unknown", type: "failed_telegram_auth", metadata: { ip, attempts } });
    await logAudit({ userId: userId || "unknown", action: "alert_failed_telegram_auth", details: { ip, attempts } });
    // Future: sendSlack, sendEmail, sendWebhook
  }

  // Log and trigger alert for referral farming
  static async referralFarming(userId: string, count: number) {
    await logSuspiciousAction({ userId, type: "referral_farming", metadata: { count } });
    await logAudit({ userId, action: "alert_referral_farming", details: { count } });
    // Future: sendSlack, sendEmail, sendWebhook
  }
}
