import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import userRoutes from "./modules/user/user.routes";
import walletRoutes from "./modules/wallet/wallet.routes";
import gameRoutes from "./modules/game/game.routes";
import vaultRoutes from "./modules/vault/vault.routes";
import authRoutes from "./modules/auth/auth.routes";
import adminRoutes from "./modules/admin/admin.routes";
import referralRoutes from "./modules/referral/referral.routes";
import statsRoutes from "./modules/stats/stats.routes";
import rewardsRoutes from "./modules/rewards/rewards.routes";
import configRoutes from "./modules/config/config.routes";
import { authMiddleware } from "./middleware/auth.middleware";
import { assertGameConfigOnStartup } from "./services/gameConfig.service";
import { correlationIdMiddleware } from "./middleware/correlationId.middleware";


const app = express();

const isProduction = env.NODE_ENV === "production";

if (isProduction) {
  const configuredOrigins = [env.FRONTEND_URL, env.FRONTEND_URL_STAGING].filter(
    (origin): origin is string => Boolean(origin),
  );

  const invalidOrigin = configuredOrigins.find((origin) => !origin.toLowerCase().startsWith("https://"));
  if (invalidOrigin) {
    throw new Error(`In production, frontend origins must use HTTPS. Invalid origin: ${invalidOrigin}`);
  }
}

const allowedOrigins = [
  env.FRONTEND_URL,
  env.FRONTEND_URL_STAGING,
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id", "Idempotency-Key", "X-Correlation-Id"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(correlationIdMiddleware);

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");

  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  next();
});

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
app.use("/api/config", configRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/rewards", authMiddleware, rewardsRoutes);

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

const port = Number(env.PORT) || 5000;

async function startServer() {
  await assertGameConfigOnStartup();

  if (env.VERCEL !== "1") {
    app.listen(port, () => {
      console.info(`Server running on port ${port}`);
    });
  }
}

if (env.NODE_ENV !== "test") {
  void startServer().catch((error) => {
    console.error("Startup validation failed:", error);
    process.exit(1);
  });
}

export default app;