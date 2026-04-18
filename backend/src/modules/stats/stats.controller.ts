import { Request, Response } from "express";
import { failure, success } from "../../utils/responder";
import { getTopWinners } from "./stats.service";

function parseLimit(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getTopWinnersHandler(req: Request, res: Response) {
  try {
    const winners = await getTopWinners(parseLimit(req.query.limit));

    return success(res, {
      winners,
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to load top winners");
  }
}
