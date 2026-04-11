import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

// Startup log and runtime check for DB user
async function logDbUser() {
	try {
		const result = await prisma.$queryRaw`SELECT current_user`;
		const user = Array.isArray(result) && result[0]?.current_user ? result[0].current_user : JSON.stringify(result);
		console.log("DB running as restricted app_user:", user);
	} catch (err) {
		console.error("Could not verify DB user:", err);
	}
}
if (process.env.NODE_ENV !== "test") {
	logDbUser();
}