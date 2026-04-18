import { Router } from "express";
import { getGameConfig } from "./config.controller";

const router = Router();

router.get("/game", getGameConfig);

export default router;
