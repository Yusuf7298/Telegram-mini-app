import crypto from "crypto";

/**
 * Verifies Telegram Mini App initData signature using HMAC-SHA256.
 * @param initData The raw initData string from Telegram
 * @param botToken The Telegram bot token
 * @returns { valid: boolean, data?: any, reason?: string }
 */
export function verifyTelegramSignature(initData: string, botToken: string): { valid: boolean; data?: any; reason?: string } {
  try {
    // Parse initData into key-value pairs
    const params = new URLSearchParams(initData);
    const data: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      data[key] = value;
    }
    const hash = data["hash"];
    if (!hash) return { valid: false, reason: "Missing hash" };
    // Remove hash for signature check
    delete data["hash"];
    // Sort keys and build data_check_string
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join("\n");
    // Compute secret key
    const secret = crypto.createHash("sha256").update(botToken).digest();
    // Compute HMAC-SHA256
    const hmac = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
    if (hmac !== hash) return { valid: false, reason: "Invalid signature" };
    // Parse user data
    let user;
    if (data.user) {
      try {
        user = JSON.parse(data.user);
      } catch {
        return { valid: false, reason: "Invalid user JSON" };
      }
    }
    return { valid: true, data: { ...data, user } };
  } catch (err) {
    return { valid: false, reason: "Signature verification error" };
  }
}
