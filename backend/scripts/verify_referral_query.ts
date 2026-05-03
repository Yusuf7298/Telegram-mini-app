import { prisma } from "../src/config/db";

async function main() {
  const row = await prisma.referralRewardGrant.findFirst({
    select: {
      id: true,
      inviterId: true,
      referredUserId: true,
      amount: true,
      sourceAction: true,
      inviter: { select: { id: true } },
      referredUser: { select: { id: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sample: row
          ? {
              ...row,
              amount: row.amount.toString(),
            }
          : null,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
