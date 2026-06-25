import { PrismaClient } from "@prisma/client";
import { liquidatePrivateBankingOnAccessRevoked } from "../src/server/bank.service";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      tags: { none: { tag: "PRIVATE_CLIENT" } },
      bankAccounts: {
        some: {
          companyId: null,
          accountType: { in: ["RESERVE", "PRIVATE"] },
          status: { not: "CLOSED" },
        },
      },
    },
    select: { id: true, discordUsername: true },
  });

  if (users.length === 0) {
    console.log("No users with revoked private access and open private accounts.");
    return;
  }

  for (const user of users) {
    const result = await liquidatePrivateBankingOnAccessRevoked(user.id);
    console.log(
      `${user.discordUsername}: closed ${result.accountsClosed} account(s), transferred ${result.totalTransferred} FLR` +
        (result.destinationAccountId ? ` → ${result.destinationAccountId}` : ""),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
