import { Router } from "express";
import { telegramLogin } from "./auth.controller";

const router = Router();

router.post("/telegram-login", telegramLogin);

export default router;
