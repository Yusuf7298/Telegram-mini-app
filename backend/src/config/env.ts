import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ADMIN_SECRET: z.string().min(1, 'ADMIN_SECRET is required'),
  ADMIN_JWT_SECRET: z.string().min(32, 'ADMIN_JWT_SECRET must be at least 32 characters'),
  FRONTEND_URL: z.string().url().optional(),
  FRONTEND_URL_STAGING: z.string().url().optional(),
  PORT: z.string().optional(),
  VERCEL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging'], {
    message: 'NODE_ENV must be one of development, test, production, staging',
  }),
});

const runtimeEnv = globalThis['process']['env'] as NodeJS.ProcessEnv;
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

export const env = parsed.data;
