-- Loan interest guarantee schedule (monthly vesting, non-capitalizing).

CREATE TYPE "LoanInterestScheduleStatus" AS ENUM ('PENDING', 'GUARANTEED', 'PAID', 'WAIVED');

CREATE TABLE "LoanInterestScheduleItem" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "guaranteeDate" TIMESTAMP(3) NOT NULL,
    "interestAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "LoanInterestScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanInterestScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoanInterestScheduleItem_loanId_installmentNumber_key" ON "LoanInterestScheduleItem"("loanId", "installmentNumber");
CREATE INDEX "LoanInterestScheduleItem_loanId_idx" ON "LoanInterestScheduleItem"("loanId");
CREATE INDEX "LoanInterestScheduleItem_status_guaranteeDate_idx" ON "LoanInterestScheduleItem"("status", "guaranteeDate");

ALTER TABLE "LoanInterestScheduleItem" ADD CONSTRAINT "LoanInterestScheduleItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
