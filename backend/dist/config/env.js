"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    REDIS_URL: zod_1.z.string().min(1, 'REDIS_URL is required'),
    TELEGRAM_BOT_TOKEN: zod_1.z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
    ADMIN_SECRET: zod_1.z.string().min(1, 'ADMIN_SECRET is required'),
    ADMIN_JWT_SECRET: zod_1.z.string().min(32, 'ADMIN_JWT_SECRET must be at least 32 characters'),
    FRONTEND_URL: zod_1.z.string().url().optional(),
    FRONTEND_URL_STAGING: zod_1.z.string().url().optional(),
    PORT: zod_1.z.string().optional(),
    VERCEL: zod_1.z.string().optional(),
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production', 'staging'], {
        message: 'NODE_ENV must be one of development, test, production, staging',
    }),
});
const runtimeEnv = globalThis['process']['env'];
const parsed = envSchema.safeParse(runtimeEnv);
if (!parsed.success) {
    console.error('ENV DEBUG:', {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        REDIS_URL: !!process.env.REDIS_URL,
        TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
        ADMIN_SECRET: !!process.env.ADMIN_SECRET,
        FRONTEND_URL: !!process.env.FRONTEND_URL,
        NODE_ENV: process.env.NODE_ENV,
    });
    const reasons = parsed.error.issues.map((issue) => issue.message).join('; ');
    console.error(`Invalid environment configuration: ${reasons}`);
    process.exit(1);
}
exports.env = parsed.data;
