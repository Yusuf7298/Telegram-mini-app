import { Request, Response } from "express";
import { getValidatedGameConfig } from "../../services/gameConfig.service";
import { failure, success } from "../../utils/responder";

export async function getGameConfig(_req: Request, res: Response) {
  try {
    const config = await getValidatedGameConfig({ bypassCache: true });

    return success(res, config);
  } catch {
    return failure(res, "INTERNAL_ERROR", "Failed to fetch game config");
  }
}
