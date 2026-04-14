import { defineConfig } from "prisma/config";
import { env } from "./src/config/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
    seed: "ts-node prisma/seed/seed.ts",
  },
  datasource: {
    url: env.DATABASE_URL,
  },
});
