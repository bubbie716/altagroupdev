-- Split loan balance into principal outstanding + accrued interest (non-capitalizing accrual model).

ALTER TABLE "Loan" ADD COLUMN "principalOutstanding" DECIMAL(18,2);
ALTER TABLE "Loan" ADD COLUMN "accruedInterest" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "LoanPayment" ADD COLUMN "appliedToInterest" DECIMAL(18,2);
ALTER TABLE "LoanPayment" ADD COLUMN "appliedToPrincipal" DECIMAL(18,2);

-- Initial copy; precise split from ledger replay runs via npm run db:backfill-loan-balance-split
UPDATE "Loan"
SET
  "principalOutstanding" = COALESCE("principalOutstanding", "outstandingBalance"),
  "accruedInterest" = COALESCE("accruedInterest", 0)
WHERE "principalOutstanding" IS NULL;

ALTER TABLE "Loan" ALTER COLUMN "principalOutstanding" SET NOT NULL;
