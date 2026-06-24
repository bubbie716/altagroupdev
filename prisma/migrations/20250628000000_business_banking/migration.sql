-- CreateEnum
CREATE TYPE "ScheduledPaymentType" AS ENUM ('ONE_TIME', 'SCHEDULED', 'RECURRING');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "ScheduledPaymentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollEmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ScheduledPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "paymentType" "ScheduledPaymentType" NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAccountNumber" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "frequency" "PaymentFrequency",
    "scheduledDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3),
    "status" "ScheduledPaymentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "accountNumber" TEXT,
    "payAmount" DECIMAL(18,2) NOT NULL,
    "payFrequency" "PaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "status" "PayrollEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "payDate" TIMESTAMP(3) NOT NULL,
    "lineItems" JSONB NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPayment_companyId_idx" ON "ScheduledPayment"("companyId");

-- CreateIndex
CREATE INDEX "ScheduledPayment_bankAccountId_idx" ON "ScheduledPayment"("bankAccountId");

-- CreateIndex
CREATE INDEX "ScheduledPayment_status_idx" ON "ScheduledPayment"("status");

-- CreateIndex
CREATE INDEX "ScheduledPayment_paymentType_idx" ON "ScheduledPayment"("paymentType");

-- CreateIndex
CREATE INDEX "PayrollEmployee_companyId_idx" ON "PayrollEmployee"("companyId");

-- CreateIndex
CREATE INDEX "PayrollEmployee_status_idx" ON "PayrollEmployee"("status");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- CreateIndex
CREATE INDEX "PayrollRun_bankAccountId_idx" ON "PayrollRun"("bankAccountId");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- AddForeignKey
ALTER TABLE "ScheduledPayment" ADD CONSTRAINT "ScheduledPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPayment" ADD CONSTRAINT "ScheduledPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPayment" ADD CONSTRAINT "ScheduledPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployee" ADD CONSTRAINT "PayrollEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
