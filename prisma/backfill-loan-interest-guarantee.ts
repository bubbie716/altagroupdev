import { backfillLoanInterestGuaranteeSchedules } from "../src/lib/bank/loan-interest-service";
import { prisma } from "../src/server/db";

async function main() {
  const result = await backfillLoanInterestGuaranteeSchedules();
  console.log(`Backfilled interest guarantee schedules for ${result.updated} loan(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
