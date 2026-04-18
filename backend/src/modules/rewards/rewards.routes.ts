import { Router } from "express";
import {
  claimDailyRewardHandler,
  getDailyRewardStatusHandler,
  getWinHistoryHandler,
} from "./rewards.controller";

const router = Router();

router.get("/daily-status", getDailyRewardStatusHandler);
router.post("/daily-claim", claimDailyRewardHandler);
router.get("/win-history", getWinHistoryHandler);

export default router;
