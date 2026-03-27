import { Router } from "express";
import { getWallet } from "./wallet.controller";

const router = Router();

router.get("/", getWallet);

export default router;