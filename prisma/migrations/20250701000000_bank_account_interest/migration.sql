-- Deposit account interest accrual (not loan interest).

CREATE TYPE "InterestRatePeriod" AS ENUM ('MONTHLY');

CREATE TYPE "BankInterestAccrualStatus" AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED', 'FAILED');

ALTER TYPE "BankTransactionType" ADD VALUE 'INTEREST_CREDIT';

ALTER TABLE "BankAccount" ADD COLUMN "interestRate" DECIMAL(10,6) NOT NULL DEFAULT 0;
ALTER TABLE "BankAccount" ADD COLUMN "interestRatePeriod" "InterestRatePeriod";
ALTER TABLE "BankAccount" ADD COLUMN "interestAccrualEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankAccount" ADD COLUMN "lastInterestAccruedAt" TIMESTAMP(3);
ALTER TABLE "BankAccount" ADD COLUMN "nextInterestAccrualAt" TIMESTAMP(3);

-- Backfill default interest settings by product type.
UPDATE "BankAccount"
SET
  "interestAccrualEnabled" = CASE
    WHEN "accountType" IN ('SAVINGS', 'MONEY_MARKET', 'PRIVATE') THEN true
    ELSE false
  END,
  "interestRate" = CASE
    WHEN "accountType" = 'SAVINGS' THEN 0.005
    WHEN "accountType" = 'MONEY_MARKET' THEN 0.0085
    WHEN "accountType" = 'PRIVATE' THEN 0.011
    ELSE 0
  END,
  "interestRatePeriod" = CASE
    WHEN "accountType" IN ('SAVINGS', 'MONEY_MARKET', 'PRIVATE') THEN 'MONTHLY'::"InterestRatePeriod"
    ELSE NULL
  END,
  "nextInterestAccrualAt" = CASE
    WHEN "accountType" IN ('SAVINGS', 'MONEY_MARKET', 'PRIVATE') AND "status" = 'ACTIVE'
      THEN "createdAt" + INTERVAL '1 month'
    ELSE NULL
  END;

CREATE TABLE "BankInterestAccrual" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "interestRate" DECIMAL(10,6) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "interestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "BankInterestAccrualStatus" NOT NULL DEFAULT 'PENDING',
    "bankTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "failureReason" TEXT,

    CONSTRAINT "BankInterestAccrual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankInterestAccrual_bankTransactionId_key" ON "BankInterestAccrual"("bankTransactionId");
CREATE UNIQUE INDEX "BankInterestAccrual_bankAccountId_periodStart_periodEnd_key" ON "BankInterestAccrual"("bankAccountId", "periodStart", "periodEnd");
CREATE INDEX "BankInterestAccrual_bankAccountId_idx" ON "BankInterestAccrual"("bankAccountId");
CREATE INDEX "BankInterestAccrual_status_idx" ON "BankInterestAccrual"("status");

ALTER TABLE "BankInterestAccrual" ADD CONSTRAINT "BankInterestAccrual_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankInterestAccrual" ADD CONSTRAINT "BankInterestAccrual_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankInterestAccrual" ADD CONSTRAINT "BankInterestAccrual_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
