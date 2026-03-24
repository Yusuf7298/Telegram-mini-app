import { Router } from "express";
import { getReferrals, registerUser } from "./user.controller";

const router = Router();

router.post("/register", registerUser);
router.get("/referrals/:userId", getReferrals);

export default router;