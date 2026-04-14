"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const env_1 = require("./env");
const connectionString = env_1.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
exports.prisma = new client_1.PrismaClient({ adapter });
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
if (env_1.env.NODE_ENV !== "test") {
    logDbUser();
}
