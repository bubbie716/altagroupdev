-- CreateEnum
CREATE TYPE "LoanScheduleInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'FAILED');

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "autoPayEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Loan" ADD COLUMN "autoPaySourceBankAccountId" TEXT;

-- CreateTable
CREATE TABLE "LoanPaymentScheduleItem" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "scheduledAmount" DECIMAL(18,2) NOT NULL,
    "status" "LoanScheduleInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "autoPayAttemptedAt" TIMESTAMP(3),
    "autoPayFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanPaymentScheduleItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN "scheduleItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayment_scheduleItemId_key" ON "LoanPayment"("scheduleItemId");
CREATE UNIQUE INDEX "LoanPaymentScheduleItem_loanId_installmentNumber_key" ON "LoanPaymentScheduleItem"("loanId", "installmentNumber");
CREATE INDEX "LoanPaymentScheduleItem_loanId_idx" ON "LoanPaymentScheduleItem"("loanId");
CREATE INDEX "LoanPaymentScheduleItem_status_dueDate_idx" ON "LoanPaymentScheduleItem"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_autoPaySourceBankAccountId_fkey" FOREIGN KEY ("autoPaySourceBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "LoanPaymentScheduleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoanPaymentScheduleItem" ADD CONSTRAINT "LoanPaymentScheduleItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
