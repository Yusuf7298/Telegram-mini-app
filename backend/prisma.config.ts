import { defineConfig } from "prisma/config";
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.trim()) {
  throw new Error('DATABASE_URL is required for Prisma CLI commands');
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
    seed: "ts-node prisma/seed/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
