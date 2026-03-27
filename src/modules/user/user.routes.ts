import { Router } from "express";
import { getCurrentUser, getReferrals, registerUser } from "./user.controller";

const router = Router();

router.post("/register", registerUser);
router.get("/", getCurrentUser);
router.get("/referrals", getReferrals);

export default router;