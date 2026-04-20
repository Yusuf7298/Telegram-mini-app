import { env } from "../config/env";
import { getCorrelationId } from "./requestContext.service";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown> & {
  userId?: string;
  endpoint?: string;
  action?: string;
};

function toRequiredContext(fields: LogFields, fallbackAction: string) {
  const userId = typeof fields.userId === "string" && fields.userId.trim() ? fields.userId : "unknown";
  const endpoint = typeof fields.endpoint === "string" && fields.endpoint.trim() ? fields.endpoint : "unknown";
  const action = typeof fields.action === "string" && fields.action.trim() ? fields.action : fallbackAction;
  const correlationIdField = (fields as Record<string, unknown>).correlationId;
  const correlationId =
    typeof correlationIdField === "string" && correlationIdField.trim()
      ? correlationIdField
      : getCorrelationId() ?? "unknown";

  return {
    userId,
    endpoint,
    action,
    correlationId,
  };
}

function writeLog(level: LogLevel, payload: Record<string, unknown>) {
  if (level === "debug" && env.NODE_ENV === "production") {
    return;
  }

  const message = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === "debug") {
    console.debug(message);
    return;
  }

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}

export async function logJackpotSkip(details: object) {
  const fields = (details || {}) as LogFields;
  const context = toRequiredContext(fields, "jackpot_skip");

  setImmediate(() => {
    writeLog("warn", {
      event: "jackpot_skip",
      ...context,
      ...fields,
    });
  });
}

export async function logStructuredEvent(event: string, fields: Record<string, unknown>) {
  const logFields = (fields || {}) as LogFields;
  const context = toRequiredContext(logFields, event || "unknown_action");

  setImmediate(() => {
    writeLog("info", {
      event,
      ...context,
      ...logFields,
    });
  });
}

export async function logDebug(event: string, fields: Record<string, unknown> = {}) {
  const logFields = (fields || {}) as LogFields;
  const context = toRequiredContext(logFields, event || "debug");

  setImmediate(() => {
    writeLog("debug", {
      event,
      ...context,
      ...logFields,
    });
  });
}

export async function logError(error: Error, context?: object) {
  const fields = (context || {}) as LogFields;
  const contextFields = toRequiredContext(fields, "error");

  setImmediate(() => {
    writeLog("error", {
      event: "error",
      ...contextFields,
      errorName: error.name,
      errorMessage: error.message,
      ...fields,
    });
  });
}
