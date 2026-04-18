import { Router } from "express";
import { getCurrentUser, getReferrals } from "./user.controller";

const router = Router();

router.get("/", getCurrentUser);
router.get("/referrals", getReferrals);

export default router;