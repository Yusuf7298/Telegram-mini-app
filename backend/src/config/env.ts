import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ADMIN_JWT_SECRET: z.string().min(32, 'ADMIN_JWT_SECRET must be at least 32 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print all validation errors and exit
  console.error('❌ Invalid environment configuration:');
  for (const err of parsed.error.errors) {
    console.error(`- ${err.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
