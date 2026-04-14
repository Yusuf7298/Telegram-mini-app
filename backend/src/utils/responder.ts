import { Response } from "express";
import { ApiErrorCode, getErrorStatus, structuredError } from "./apiResponse";

export function success(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
}

export function failure(res: Response, code: ApiErrorCode, message: string) {
  return res.status(getErrorStatus(code)).json(structuredError(code, message));
}
