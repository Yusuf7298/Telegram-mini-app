"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const game_routes_1 = __importDefault(require("./modules/game/game.routes"));
const vault_routes_1 = __importDefault(require("./modules/vault/vault.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const app = (0, express_1.default)();
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_STAGING,
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
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use((0, cors_1.default)(corsOptions));
app.options("*", (0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.send("API Running 🚀");
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api", auth_middleware_1.authMiddleware);
app.use("/api/user", user_routes_1.default);
app.use("/api/wallet", wallet_routes_1.default);
app.use("/api/game", game_routes_1.default);
app.use("/api/vault", vault_routes_1.default);
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
const port = Number(process.env.PORT) || 5000;
if (process.env.VERCEL !== "1") {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
exports.default = app;
