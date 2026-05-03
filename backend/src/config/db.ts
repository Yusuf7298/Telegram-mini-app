import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "./env";

type GlobalForPrisma = typeof globalThis & {
	prisma?: PrismaClient;
	prismaPool?: Pool;
	hasLoggedDbUser?: boolean;
	prismaShutdownHandlersRegistered?: boolean;
};

function ensurePgbouncerUrl(databaseUrl: string): string {
	if (env.PGBOUNCER_DISABLED === "1") {
		return databaseUrl;
	}

	const explicitPooledUrl = env.DATABASE_URL_POOLED?.trim();
	if (explicitPooledUrl) {
		return explicitPooledUrl;
	}

	const poolLimit = Number(env.PG_POOL_MAX ?? "25");
	const poolTimeoutSeconds = Math.max(2, Math.floor(Number(env.PG_CONNECTION_TIMEOUT_MS ?? "10000") / 1000));

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
		if (!parsed.searchParams.has("connection_limit")) {
			parsed.searchParams.set("connection_limit", String(Number.isFinite(poolLimit) ? poolLimit : 25));
		}
		if (!parsed.searchParams.has("pool_timeout")) {
			parsed.searchParams.set("pool_timeout", String(poolTimeoutSeconds));
		}
		return parsed.toString();
	} catch {
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
		if (!nextUrl.includes("connection_limit=")) {
			nextUrl = `${nextUrl}&connection_limit=${Number.isFinite(poolLimit) ? poolLimit : 25}`;
		}
		if (!nextUrl.includes("pool_timeout=")) {
			nextUrl = `${nextUrl}&pool_timeout=${poolTimeoutSeconds}`;
		}
		return nextUrl;
	}
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

	const handleShutdown = (signal: NodeJS.Signals) => {
		void shutdownPrismaResources().finally(() => {
			if (env.NODE_ENV !== "test") {
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

const connectionString = env.DATABASE_URL;
const poolMax = Number(env.PG_POOL_MAX ?? "25");
const poolIdleTimeoutMs = Number(env.PG_IDLE_TIMEOUT_MS ?? "30000");
const poolConnectionTimeoutMs = Number(env.PG_CONNECTION_TIMEOUT_MS ?? "10000");

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as GlobalForPrisma;
const pooledConnectionString = ensurePgbouncerUrl(connectionString);

const pool = globalForPrisma.prismaPool ?? new Pool({
	connectionString: pooledConnectionString,
	max: Number.isFinite(poolMax) ? poolMax : 50,
	idleTimeoutMillis: Number.isFinite(poolIdleTimeoutMs) ? poolIdleTimeoutMs : 30_000,
	connectionTimeoutMillis: Number.isFinite(poolConnectionTimeoutMs) ? poolConnectionTimeoutMs : 10_000,
});

globalForPrisma.prismaPool = pool;

const adapter = new PrismaPg(pool);

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
		log: ["error", "warn"],
	});

globalForPrisma.prisma = prisma;
registerGracefulShutdownHandlers();

// Startup log and runtime check for DB user
async function logDbUser() {
	try {
		const result = await prisma.$queryRaw`SELECT current_user`;
		const user = Array.isArray(result) && result[0]?.current_user ? result[0].current_user : JSON.stringify(result);
		if (env.NODE_ENV !== "production") {
			console.debug("DB running as restricted app_user:", user);
		}
	} catch (err) {
		console.error("Could not verify DB user:", err);
	}
}
if (env.NODE_ENV !== "test" && !globalForPrisma.hasLoggedDbUser) {
	void logDbUser();
	if (process.env.NODE_ENV !== "production") {
		globalForPrisma.hasLoggedDbUser = true;
	}
}