-- Commercial Pro subscription billing

ALTER TABLE "Company"
  ADD COLUMN "commercialBillingAccountId" TEXT,
  ADD COLUMN "commercialNextBillingAt" TIMESTAMP(3),
  ADD COLUMN "commercialPastDueAt" TIMESTAMP(3),
  ADD COLUMN "commercialProSubscribedAt" TIMESTAMP(3);

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_commercialBillingAccountId_fkey"
  FOREIGN KEY ("commercialBillingAccountId") REFERENCES "BankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Company_commercialBillingAccountId_idx" ON "Company"("commercialBillingAccountId");
CREATE INDEX "Company_commercialNextBillingAt_idx" ON "Company"("commercialNextBillingAt");

ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_ACTIVATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_BILLING_SUCCEEDED';
ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_BILLING_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_PAST_DUE';
ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_DOWNGRADED';
ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_BILLING_ACCOUNT_CHANGED';
