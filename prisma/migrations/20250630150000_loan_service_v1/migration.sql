-- AlterEnum
ALTER TYPE "BankTransactionType" ADD VALUE 'LOAN_PAYMENT';
ALTER TYPE "BankTransactionType" ADD VALUE 'INTEREST_CHARGE';

-- CreateEnum
CREATE TYPE "LoanInterestRateType" AS ENUM ('ANNUAL_PERCENT');
CREATE TYPE "LoanLedgerEntryType" AS ENUM ('DISBURSEMENT', 'PAYMENT', 'INTEREST_CHARGE', 'ADJUSTMENT', 'STATUS_CHANGE');

-- AlterTable Loan
ALTER TABLE "Loan" ADD COLUMN "interestRateType" "LoanInterestRateType" NOT NULL DEFAULT 'ANNUAL_PERCENT';
ALTER TABLE "Loan" ADD COLUMN "lastInterestAccruedAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN "nextInterestAccrualAt" TIMESTAMP(3);
CREATE INDEX "Loan_nextInterestAccrualAt_idx" ON "Loan"("nextInterestAccrualAt");

-- AlterTable LoanPayment
ALTER TABLE "LoanPayment" ADD COLUMN "bankTransactionId" TEXT;
ALTER TABLE "LoanPayment" ADD COLUMN "memo" TEXT;
CREATE UNIQUE INDEX "LoanPayment_bankTransactionId_key" ON "LoanPayment"("bankTransactionId");

-- CreateTable LoanLedgerEntry
CREATE TABLE "LoanLedgerEntry" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "type" "LoanLedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "bankTransactionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoanLedgerEntry_loanId_idx" ON "LoanLedgerEntry"("loanId");
CREATE INDEX "LoanLedgerEntry_type_idx" ON "LoanLedgerEntry"("type");
CREATE INDEX "LoanLedgerEntry_createdAt_idx" ON "LoanLedgerEntry"("createdAt");

ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanLedgerEntry" ADD CONSTRAINT "LoanLedgerEntry_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanLedgerEntry" ADD CONSTRAINT "LoanLedgerEntry_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanLedgerEntry" ADD CONSTRAINT "LoanLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill next interest accrual for existing active loans (one month from approval)
UPDATE "Loan"
SET "nextInterestAccrualAt" = "approvedAt" + INTERVAL '1 month',
    "lastInterestAccruedAt" = "approvedAt"
WHERE "status" IN ('ACTIVE', 'FROZEN') AND "nextInterestAccrualAt" IS NULL;
