-- Track partial installment payments; allow multiple payments per schedule row.

ALTER TABLE "LoanPaymentScheduleItem" ADD COLUMN "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "LoanPayment_scheduleItemId_key";

CREATE INDEX "LoanPayment_scheduleItemId_idx" ON "LoanPayment"("scheduleItemId");

-- Mark fully paid rows that predate paidAmount tracking.
UPDATE "LoanPaymentScheduleItem"
SET "paidAmount" = "scheduledAmount"
WHERE "status" = 'PAID';
