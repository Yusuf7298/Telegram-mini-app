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
    ADMIN_JWT_SECRET: zod_1.z.string().min(32, 'ADMIN_JWT_SECRET must be at least 32 characters'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // Print all validation errors and exit
    console.error('❌ Invalid environment configuration:');
    for (const err of parsed.error.issues) {
        console.error(`- ${err.message}`);
    }
    process.exit(1);
}
exports.env = parsed.data;
