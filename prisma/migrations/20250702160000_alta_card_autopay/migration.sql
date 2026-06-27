-- Alta Card autopay settings and run tracking.

CREATE TYPE "AltaCardAutopayType" AS ENUM ('MINIMUM_PAYMENT', 'STATEMENT_BALANCE', 'FIXED_AMOUNT');
CREATE TYPE "AltaCardAutopayStatus" AS ENUM ('NOT_RUN', 'SUCCESS', 'FAILED', 'SKIPPED');

ALTER TABLE "AltaCard" ADD COLUMN "autopayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AltaCard" ADD COLUMN "autopaySourceAccountId" TEXT;
ALTER TABLE "AltaCard" ADD COLUMN "autopayType" "AltaCardAutopayType";
ALTER TABLE "AltaCard" ADD COLUMN "autopayFixedAmount" DECIMAL(18,2);
ALTER TABLE "AltaCard" ADD COLUMN "autopayLastRunAt" TIMESTAMP(3);
ALTER TABLE "AltaCard" ADD COLUMN "autopayLastStatus" "AltaCardAutopayStatus" NOT NULL DEFAULT 'NOT_RUN';
ALTER TABLE "AltaCard" ADD COLUMN "autopayFailureReason" TEXT;

CREATE INDEX "AltaCard_autopayEnabled_idx" ON "AltaCard"("autopayEnabled");
CREATE INDEX "AltaCard_autopaySourceAccountId_idx" ON "AltaCard"("autopaySourceAccountId");

ALTER TABLE "AltaCard" ADD CONSTRAINT "AltaCard_autopaySourceAccountId_fkey" FOREIGN KEY ("autopaySourceAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
