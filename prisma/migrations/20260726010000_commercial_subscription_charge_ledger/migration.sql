-- Commercial Pro subscription charge ledger + scheduled downgrade support

CREATE TYPE "CommercialSubscriptionChargeType" AS ENUM ('INITIAL_PURCHASE', 'MONTHLY_RENEWAL');
CREATE TYPE "CommercialSubscriptionChargeStatus" AS ENUM ('SUCCEEDED', 'FAILED');

ALTER TABLE "Company"
  ADD COLUMN "commercialBillingCycleId" TEXT,
  ADD COLUMN "commercialDowngradeScheduledAt" TIMESTAMP(3);

CREATE INDEX "Company_commercialDowngradeScheduledAt_idx"
  ON "Company"("commercialDowngradeScheduledAt");

CREATE TABLE "CommercialSubscriptionCharge" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "billingAccountId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "billingPeriod" TEXT NOT NULL,
  "chargeType" "CommercialSubscriptionChargeType" NOT NULL,
  "status" "CommercialSubscriptionChargeStatus" NOT NULL,
  "bankTransactionId" TEXT,
  "referenceCode" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "failureReason" TEXT,
  "billingCycleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommercialSubscriptionCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialSubscriptionCharge_idempotencyKey_key"
  ON "CommercialSubscriptionCharge"("idempotencyKey");

CREATE UNIQUE INDEX "CommercialSubscriptionCharge_companyId_billingPeriod_chargeType_key"
  ON "CommercialSubscriptionCharge"("companyId", "billingPeriod", "chargeType");

CREATE INDEX "CommercialSubscriptionCharge_companyId_idx"
  ON "CommercialSubscriptionCharge"("companyId");

CREATE INDEX "CommercialSubscriptionCharge_billingAccountId_idx"
  ON "CommercialSubscriptionCharge"("billingAccountId");

CREATE INDEX "CommercialSubscriptionCharge_status_idx"
  ON "CommercialSubscriptionCharge"("status");

CREATE INDEX "CommercialSubscriptionCharge_billingCycleId_idx"
  ON "CommercialSubscriptionCharge"("billingCycleId");

ALTER TABLE "CommercialSubscriptionCharge"
  ADD CONSTRAINT "CommercialSubscriptionCharge_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommercialSubscriptionCharge"
  ADD CONSTRAINT "CommercialSubscriptionCharge_billingAccountId_fkey"
  FOREIGN KEY ("billingAccountId") REFERENCES "BankAccount"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommercialSubscriptionCharge"
  ADD CONSTRAINT "CommercialSubscriptionCharge_bankTransactionId_fkey"
  FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
