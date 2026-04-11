import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import userRoutes from "./modules/user/user.routes";
import walletRoutes from "./modules/wallet/wallet.routes";
import gameRoutes from "./modules/game/game.routes";
import vaultRoutes from "./modules/vault/vault.routes";
import authRoutes from "./modules/auth/auth.routes";
import adminRoutes from "./modules/admin/admin.routes";
import referralRoutes from "./modules/referral/referral.routes";
import { authMiddleware } from "./middleware/auth.middleware";


const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_STAGING,
  "https://web.telegram.org",
  "https://t.me",
].filter((origin): origin is string => Boolean(origin));

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header (webviews, server-to-server calls).
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

import { decimalSerializer } from './middleware/decimalSerializer';
app.use(express.json());
app.use(decimalSerializer);

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api", adminRoutes);
app.use("/api/user", authMiddleware, userRoutes);
app.use("/api/wallet", authMiddleware, walletRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/vault", authMiddleware, vaultRoutes);
app.use("/api/referral", referralRoutes);

app.get("/test", async (req, res) => {
  res.send("Working ✅");
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  const error = err as { status?: number; message?: string };
  const status =
    typeof error.status === "number" && error.status >= 400
      ? error.status
      : 500;
  const message =
    typeof error.message === "string" && error.message.trim().length > 0
      ? error.message
      : "Internal Server Error";

  return res.status(status).json({
    success: false,
    error: message,
  });
});

const port = Number(process.env.PORT) || 5000;

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;