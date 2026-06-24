import { backfillLegacyLoanInterest } from "../src/server/loan.service";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("Dry run is not supported — this script applies rate fixes and catch-up accrual.");
    process.exit(1);
  }

  console.log("Backfilling legacy loan interest (rate type fix + catch-up accrual)…");
  const result = await backfillLegacyLoanInterest();

  console.log(`Rate types fixed: ${result.rateTypeFixed}`);
  console.log(`Loans with catch-up accrual: ${result.loansWithCatchUp}`);
  console.log(`Total accrual periods: ${result.totalPeriods}`);
  console.log(`Total interest accrued: ƒ${result.totalInterest.toLocaleString()}`);

  if (result.loans.length === 0) {
    console.log("No loans required changes.");
    return;
  }

  console.log("\nLoan details:");
  for (const loan of result.loans) {
    console.log(
      [
        `- ${loan.loanId}`,
        `product=${loan.productType}`,
        `rate ${loan.oldRate}% (${loan.oldRateType}) → ${loan.newRate}% monthly`,
        `periods=${loan.periods}`,
        `interest=ƒ${loan.interest.toLocaleString()}`,
        `outstanding=ƒ${loan.outstandingAfter.toLocaleString()}`,
      ].join(" · "),
    );
  }
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
