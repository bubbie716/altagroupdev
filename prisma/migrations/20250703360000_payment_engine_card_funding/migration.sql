-- Allow Alta Card funding for Alta Pay schedules and merchant AutoPay approvals.

ALTER TABLE "ScheduledPayment" ADD COLUMN "fundingSource" JSONB;

UPDATE "ScheduledPayment"
SET "fundingSource" = jsonb_build_object('kind', 'bank_account', 'accountId', "bankAccountId")
WHERE "paymentChannel" = 'ALTA_PAY';

ALTER TABLE "ScheduledPayment" ALTER COLUMN "bankAccountId" DROP NOT NULL;

ALTER TABLE "MerchantAutopayApproval" ADD COLUMN "fundingSource" JSONB;
ALTER TABLE "MerchantAutopayApproval" ADD COLUMN "fundingSourceKey" TEXT;

UPDATE "MerchantAutopayApproval"
SET
  "fundingSource" = jsonb_build_object('kind', 'bank_account', 'accountId', "fundingAccountId"),
  "fundingSourceKey" = 'bank_account:' || "fundingAccountId";

ALTER TABLE "MerchantAutopayApproval" ALTER COLUMN "fundingSource" SET NOT NULL;
ALTER TABLE "MerchantAutopayApproval" ALTER COLUMN "fundingSourceKey" SET NOT NULL;
ALTER TABLE "MerchantAutopayApproval" ALTER COLUMN "fundingAccountId" DROP NOT NULL;

DROP INDEX IF EXISTS "MerchantAutopayApproval_userId_merchantCompanyId_fundingAccountId_key";

CREATE UNIQUE INDEX "MerchantAutopayApproval_userId_merchantCompanyId_fundingSourceKey_key"
  ON "MerchantAutopayApproval"("userId", "merchantCompanyId", "fundingSourceKey");
