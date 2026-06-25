import { backfillLoanBalanceSplitFromLedger } from "@/lib/bank/loan-interest-service";

async function main() {
  const result = await backfillLoanBalanceSplitFromLedger();
  console.log(`Backfilled ${result.updated} loan(s) from ledger replay.`);
  for (const row of result.loans) {
    console.log(
      `  ${row.loanId}: principal=${row.principalOutstanding.toFixed(2)}, accrued=${row.accruedInterest.toFixed(2)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
