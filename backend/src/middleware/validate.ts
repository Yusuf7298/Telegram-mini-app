import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { getErrorStatus, structuredError } from "../utils/apiResponse";

export function validateBody(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(getErrorStatus("INVALID_INPUT")).json(
        structuredError("INVALID_INPUT", "Validation error")
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(getErrorStatus("INVALID_INPUT")).json(
        structuredError("INVALID_INPUT", "Validation error")
      );
    }
    req.query = result.data;
    next();
  };
}
