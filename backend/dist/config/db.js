"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const env_1 = require("./env");
const retryPrisma_1 = require("../services/retryPrisma");
function ensurePgbouncerUrl(databaseUrl) {
    if (process.env.PGBOUNCER_DISABLED === "1") {
        return databaseUrl;
    }
    const explicitPooledUrl = process.env.DATABASE_URL_POOLED?.trim();
    if (explicitPooledUrl) {
        return explicitPooledUrl;
    }
    try {
        const parsed = new URL(databaseUrl);
        if (!parsed.searchParams.has("pgbouncer")) {
            parsed.searchParams.set("pgbouncer", "true");
        }
        if (!parsed.searchParams.has("connect_timeout")) {
            parsed.searchParams.set("connect_timeout", "10");
        }
        if (!parsed.searchParams.has("sslmode")) {
            parsed.searchParams.set("sslmode", "require");
        }
        if (!parsed.searchParams.has("uselibpqcompat")) {
            parsed.searchParams.set("uselibpqcompat", "true");
        }
        return parsed.toString();
    }
    catch {
        let nextUrl = databaseUrl;
        if (!nextUrl.includes("pgbouncer=true")) {
            nextUrl = nextUrl.includes("?") ? `${nextUrl}&pgbouncer=true` : `${nextUrl}?pgbouncer=true`;
        }
        if (!nextUrl.includes("connect_timeout=")) {
            nextUrl = `${nextUrl}&connect_timeout=10`;
        }
        if (!nextUrl.includes("sslmode=")) {
            nextUrl = `${nextUrl}&sslmode=require`;
        }
        if (!nextUrl.includes("uselibpqcompat=")) {
            nextUrl = `${nextUrl}&uselibpqcompat=true`;
        }
        return nextUrl;
    }
}
function withRetryExtension(client) {
    const extended = client.$extends({
        query: {
            $allModels: {
                async $allOperations({ args, query }) {
                    return (0, retryPrisma_1.retryPrisma)(() => query(args));
                },
            },
            async $allOperations({ args, query }) {
                return (0, retryPrisma_1.retryPrisma)(() => query(args));
            },
        },
    });
    return extended;
}
async function shutdownPrismaResources() {
    await Promise.allSettled([
        globalForPrisma.prisma?.$disconnect(),
        globalForPrisma.prismaPool?.end(),
    ]);
}
function registerGracefulShutdownHandlers() {
    if (globalForPrisma.prismaShutdownHandlersRegistered) {
        return;
    }
    globalForPrisma.prismaShutdownHandlersRegistered = true;
    const handleShutdown = (signal) => {
        void shutdownPrismaResources().finally(() => {
            if (env_1.env.NODE_ENV !== "test") {
                process.exit(0);
            }
        });
    };
    process.once("SIGINT", handleShutdown);
    process.once("SIGTERM", handleShutdown);
    process.once("beforeExit", () => {
        void shutdownPrismaResources();
    });
}
const connectionString = env_1.env.DATABASE_URL;
const poolMax = Number(process.env.PG_POOL_MAX ?? "50");
const poolIdleTimeoutMs = Number(process.env.PG_IDLE_TIMEOUT_MS ?? "30000");
const poolConnectionTimeoutMs = Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? "10000");
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}
const globalForPrisma = globalThis;
const pooledConnectionString = ensurePgbouncerUrl(connectionString);
const pool = globalForPrisma.prismaPool ?? new pg_1.Pool({
    connectionString: pooledConnectionString,
    max: Number.isFinite(poolMax) ? poolMax : 50,
    idleTimeoutMillis: Number.isFinite(poolIdleTimeoutMs) ? poolIdleTimeoutMs : 30000,
    connectionTimeoutMillis: Number.isFinite(poolConnectionTimeoutMs) ? poolConnectionTimeoutMs : 10000,
});
globalForPrisma.prismaPool = pool;
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = globalForPrisma.prisma ??
    withRetryExtension(new client_1.PrismaClient({
        adapter,
        log: ["error", "warn"],
    }));
globalForPrisma.prisma = exports.prisma;
registerGracefulShutdownHandlers();
// Startup log and runtime check for DB user
async function logDbUser() {
    try {
        const result = await exports.prisma.$queryRaw `SELECT current_user`;
        const user = Array.isArray(result) && result[0]?.current_user ? result[0].current_user : JSON.stringify(result);
        if (env_1.env.NODE_ENV !== "production") {
            console.debug("DB running as restricted app_user:", user);
        }
    }
    catch (err) {
        console.error("Could not verify DB user:", err);
    }
}
if (env_1.env.NODE_ENV !== "test" && !globalForPrisma.hasLoggedDbUser) {
    void logDbUser();
    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.hasLoggedDbUser = true;
    }
}
