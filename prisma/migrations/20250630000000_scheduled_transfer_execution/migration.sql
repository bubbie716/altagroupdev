-- AlterEnum
ALTER TYPE "ScheduledPaymentStatus" ADD VALUE 'PAUSED';
ALTER TYPE "ScheduledPaymentStatus" ADD VALUE 'FAILED';

-- CreateEnum
CREATE TYPE "ScheduledTransferExecutionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "ScheduledPayment" ADD COLUMN "lastRunAt" TIMESTAMP(3),
ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailureReason" TEXT,
ADD COLUMN "lastExecutionStatus" "ScheduledTransferExecutionStatus";

-- CreateTable
CREATE TABLE "ScheduledTransferExecution" (
    "id" TEXT NOT NULL,
    "scheduledPaymentId" TEXT NOT NULL,
    "scheduledRunAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledTransferExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "bankTransactionId" TEXT,
    "failureReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledTransferExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPayment_nextRunDate_idx" ON "ScheduledPayment"("nextRunDate");
CREATE INDEX "ScheduledPayment_scheduledDate_idx" ON "ScheduledPayment"("scheduledDate");
CREATE INDEX "ScheduledTransferExecution_scheduledPaymentId_idx" ON "ScheduledTransferExecution"("scheduledPaymentId");
CREATE INDEX "ScheduledTransferExecution_status_idx" ON "ScheduledTransferExecution"("status");
CREATE INDEX "ScheduledTransferExecution_scheduledRunAt_idx" ON "ScheduledTransferExecution"("scheduledRunAt");
CREATE UNIQUE INDEX "ScheduledTransferExecution_scheduledPaymentId_scheduledRunAt_key" ON "ScheduledTransferExecution"("scheduledPaymentId", "scheduledRunAt");

-- AddForeignKey
ALTER TABLE "ScheduledTransferExecution" ADD CONSTRAINT "ScheduledTransferExecution_scheduledPaymentId_fkey" FOREIGN KEY ("scheduledPaymentId") REFERENCES "ScheduledPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledTransferExecution" ADD CONSTRAINT "ScheduledTransferExecution_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
