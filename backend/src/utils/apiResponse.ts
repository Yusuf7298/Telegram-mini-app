import { env } from "../config/env";

// Unified API response helpers for all endpoints
// Ensures: { success, data, error } structure
// No stack traces in production, safe error messages, Unity-friendly

export type ApiErrorCode =
  | "RATE_LIMIT"
  | "REPLAY_ATTACK"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
};

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  RATE_LIMIT: 429,
  REPLAY_ATTACK: 409,
  INSUFFICIENT_FUNDS: 400,
  INVALID_INPUT: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

function inferErrorCode(message: string): ApiErrorCode {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("burst")) {
    return "RATE_LIMIT";
  }
  if (normalized.includes("replay") || normalized.includes("duplicate") || normalized.includes("signature")) {
    return "REPLAY_ATTACK";
  }
  if (normalized.includes("insufficient")) {
    return "INSUFFICIENT_FUNDS";
  }
  if (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("validation") ||
    normalized.includes("missing")
  ) {
    return "INVALID_INPUT";
  }
  if (normalized.includes("unauthorized") || normalized.includes("auth")) {
    return "UNAUTHORIZED";
  }
  if (normalized.includes("forbidden") || normalized.includes("access required")) {
    return "FORBIDDEN";
  }
  if (normalized.includes("not found")) {
    return "NOT_FOUND";
  }

  return "INTERNAL_ERROR";
}

export function getErrorStatus(code: ApiErrorCode): number {
  return ERROR_STATUS[code] ?? 500;
}

export function successResponse(data: object | null = null) {
  return {
    success: true,
    data,
    error: null,
  };
}

export function errorResponse(
  message: string,
  opts?: { production?: boolean; code?: ApiErrorCode }
) {
  const safeMsg =
    opts?.production || env.NODE_ENV === "production"
      ? sanitizeErrorMessage(message)
      : message;
  return {
    success: false,
    error: {
      code: opts?.code ?? inferErrorCode(safeMsg),
      message: safeMsg,
    } satisfies ApiErrorPayload,
  };
}

export function structuredError(code: ApiErrorCode, message: string, opts?: { production?: boolean }) {
  return errorResponse(message, { ...opts, code });
}

function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "An error occurred";
  if (/stack|sql|prisma|trace|exception|database|failed/i.test(msg)) {
    return "An error occurred";
  }
  if (msg.length > 120) return "An error occurred";
  return msg;
}
