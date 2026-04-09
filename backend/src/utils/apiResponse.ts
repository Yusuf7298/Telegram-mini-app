// Unified API response helpers for all endpoints
// Ensures: { success, data, error } structure
// No stack traces in production, safe error messages, Unity-friendly

export function successResponse(data: object | null = null) {
  return {
    success: true,
    data,
    error: null,
  };
}

export function errorResponse(message: string, opts?: { production?: boolean }) {
  // Only expose safe error messages
  const safeMsg =
    opts?.production || process.env.NODE_ENV === "production"
      ? sanitizeErrorMessage(message)
      : message;
  return {
    success: false,
    data: null,
    error: safeMsg,
  };
}

function sanitizeErrorMessage(msg: string): string {
  // Remove stack traces, SQL, or sensitive info
  if (!msg) return "An error occurred";
  if (/stack|sql|prisma|trace|exception|database|failed/i.test(msg)) {
    return "An error occurred";
  }
  // Optionally, restrict to a whitelist of safe errors
  if (msg.length > 120) return "An error occurred";
  return msg;
}
