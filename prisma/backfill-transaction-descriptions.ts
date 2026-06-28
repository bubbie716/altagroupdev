import { backfillCustomerTransactionDescriptions } from "../src/server/customer-transaction-description-backfill.service";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(
    dryRun
      ? "Dry run — scanning transaction descriptions (no writes)…"
      : "Backfilling customer transaction descriptions…",
  );

  const result = await backfillCustomerTransactionDescriptions({ dryRun });

  console.log(
    JSON.stringify(
      {
        dryRun,
        bankTransactionsUpdated: result.bankTransactionsUpdated,
        altaCardTransactionsUpdated: result.altaCardTransactionsUpdated,
        loanLedgerEntriesUpdated: result.loanLedgerEntriesUpdated,
        bankTransactionsSkipped: result.bankTransactionsSkipped,
        altaCardTransactionsSkipped: result.altaCardTransactionsSkipped,
        loanLedgerEntriesSkipped: result.loanLedgerEntriesSkipped,
      },
      null,
      2,
    ),
  );
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
