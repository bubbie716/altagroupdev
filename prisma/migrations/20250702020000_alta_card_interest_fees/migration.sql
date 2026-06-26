-- Alta Card interest, fees, and statement payment buckets

CREATE TYPE "AltaCardFeeType" AS ENUM ('LATE_PAYMENT', 'CASH_ADVANCE', 'OVER_LIMIT', 'MANUAL');
CREATE TYPE "AltaCardFeeStatus" AS ENUM ('ACTIVE', 'WAIVED', 'PAID');

ALTER TABLE "AltaCardStatement"
  ADD COLUMN "feesPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "remainingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "overdueAt" TIMESTAMP(3),
  ADD COLUMN "interestAppliedAt" TIMESTAMP(3);

UPDATE "AltaCardStatement"
SET "remainingBalance" = GREATEST(0, "statementBalance" - "amountPaid")
WHERE "status" != 'OPEN';

CREATE TABLE "AltaCardFee" (
  "id" TEXT NOT NULL,
  "altaCardId" TEXT NOT NULL,
  "altaCardStatementId" TEXT,
  "altaCardTransactionId" TEXT,
  "type" "AltaCardFeeType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" "AltaCardFeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "waivedByUserId" TEXT,
  "waivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AltaCardFee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AltaCardFee_altaCardTransactionId_key" ON "AltaCardFee"("altaCardTransactionId");
CREATE INDEX "AltaCardFee_altaCardId_idx" ON "AltaCardFee"("altaCardId");
CREATE INDEX "AltaCardFee_altaCardStatementId_idx" ON "AltaCardFee"("altaCardStatementId");
CREATE INDEX "AltaCardFee_type_idx" ON "AltaCardFee"("type");
CREATE INDEX "AltaCardFee_status_idx" ON "AltaCardFee"("status");

ALTER TABLE "AltaCardFee"
  ADD CONSTRAINT "AltaCardFee_altaCardId_fkey"
  FOREIGN KEY ("altaCardId") REFERENCES "AltaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AltaCardFee"
  ADD CONSTRAINT "AltaCardFee_altaCardStatementId_fkey"
  FOREIGN KEY ("altaCardStatementId") REFERENCES "AltaCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardFee"
  ADD CONSTRAINT "AltaCardFee_altaCardTransactionId_fkey"
  FOREIGN KEY ("altaCardTransactionId") REFERENCES "AltaCardTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardFee"
  ADD CONSTRAINT "AltaCardFee_waivedByUserId_fkey"
  FOREIGN KEY ("waivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
