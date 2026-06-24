-- CreateEnum
CREATE TYPE "ScheduledTransferScope" AS ENUM ('INTRABANK', 'INTERBANK');

-- AlterTable
ALTER TABLE "ScheduledPayment" ADD COLUMN "transferScope" "ScheduledTransferScope" NOT NULL DEFAULT 'INTRABANK';
ALTER TABLE "ScheduledPayment" ADD COLUMN "recipientInstitution" TEXT;
ALTER TABLE "ScheduledPayment" ADD COLUMN "routingNumber" TEXT;
ALTER TABLE "ScheduledPayment" ADD COLUMN "wireAccountNumber" TEXT;
ALTER TABLE "ScheduledPayment" ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ScheduledPayment_createdByUserId_idx" ON "ScheduledPayment"("createdByUserId");
CREATE INDEX "ScheduledPayment_transferScope_idx" ON "ScheduledPayment"("transferScope");
