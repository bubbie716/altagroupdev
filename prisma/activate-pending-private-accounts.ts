import { activatePendingPrivateBankAccounts } from "../src/server/bank.service";

async function main() {
  console.log("Activating pending private banking accounts for enrolled private clients…");
  const { updated } = await activatePendingPrivateBankAccounts();
  console.log(`Updated ${updated} account(s) to ACTIVE.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/server/db");
    await prisma.$disconnect();
  });
