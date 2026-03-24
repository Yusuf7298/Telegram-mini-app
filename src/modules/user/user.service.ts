import { prisma } from "../../config/db";

export async function createUser(platformId: string, username?: string) {
  const existing = await prisma.user.findUnique({
    where: { platformId },
  });

  if (existing) return existing;

  return prisma.user.create({
    data: {
      platformId,
      username,
      wallet: {
        create: {},
      },
    },
  });
}