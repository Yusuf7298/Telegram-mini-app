"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const game_routes_1 = __importDefault(require("./modules/game/game.routes"));
const vault_routes_1 = __importDefault(require("./modules/vault/vault.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const referral_routes_1 = __importDefault(require("./modules/referral/referral.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const app = (0, express_1.default)();
const isProduction = env_1.env.NODE_ENV === "production";
if (isProduction) {
    const configuredOrigins = [env_1.env.FRONTEND_URL, env_1.env.FRONTEND_URL_STAGING].filter((origin) => Boolean(origin));
    const invalidOrigin = configuredOrigins.find((origin) => !origin.toLowerCase().startsWith("https://"));
    if (invalidOrigin) {
        throw new Error(`In production, frontend origins must use HTTPS. Invalid origin: ${invalidOrigin}`);
    }
}
const allowedOrigins = [
    env_1.env.FRONTEND_URL,
    env_1.env.FRONTEND_URL_STAGING,
    "https://web.telegram.org",
    "https://t.me",
].filter((origin) => Boolean(origin));
const corsOptions = {
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id", "Idempotency-Key"],
};
app.use((0, cors_1.default)(corsOptions));
app.options(/.*/, (0, cors_1.default)(corsOptions));
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
const decimalSerializer_1 = require("./middleware/decimalSerializer");
app.use(express_1.default.json());
app.use(decimalSerializer_1.decimalSerializer);
app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
});
app.get("/", (req, res) => {
    res.send("API Running 🚀");
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api", admin_routes_1.default);
app.use("/api/user", auth_middleware_1.authMiddleware, user_routes_1.default);
app.use("/api/wallet", auth_middleware_1.authMiddleware, wallet_routes_1.default);
app.use("/api/game", game_routes_1.default);
app.use("/api/vault", auth_middleware_1.authMiddleware, vault_routes_1.default);
app.use("/api/referral", referral_routes_1.default);
app.get("/test", async (req, res) => {
    res.send("Working ✅");
});
app.use((err, _req, res, _next) => {
    console.error(err);
    const error = err;
    const status = typeof error.status === "number" && error.status >= 400
        ? error.status
        : 500;
    const message = typeof error.message === "string" && error.message.trim().length > 0
        ? error.message
        : "Internal Server Error";
    return res.status(status).json({
        success: false,
        error: message,
    });
});
const port = Number(env_1.env.PORT) || 5000;
if (env_1.env.VERCEL !== "1") {
    app.listen(port, () => {
        console.info(`Server running on port ${port}`);
    });
}
exports.default = app;
