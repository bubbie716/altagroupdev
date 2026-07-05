-- Payments Engine: Alta Pay schedules, merchant AutoPay, recurring invoices

-- AlterEnum
ALTER TYPE "PaymentFrequency" ADD VALUE 'YEARLY';

-- CreateEnum
CREATE TYPE "ScheduledPaymentChannel" AS ENUM ('TRANSFER', 'ALTA_PAY');
CREATE TYPE "MerchantAutopayApprovalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
CREATE TYPE "RecurringInvoiceScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterEnum UserNotificationType
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_SCHEDULED_CREATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_SCHEDULED_EXECUTED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_SCHEDULED_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_CREATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_PAUSED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_RESUMED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_CANCELLED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_EXECUTED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RECURRING_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_AUTOPAY_APPROVAL_CREATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_AUTOPAY_APPROVAL_UPDATED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_AUTOPAY_APPROVAL_PAUSED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_AUTOPAY_APPROVAL_CANCELLED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_AUTOPAID';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_AUTOPAY_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_RECURRING_INVOICE_RECEIVED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RETRY_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_RETRY_FINAL_FAILED';

-- AlterEnum AuditEntityType
ALTER TYPE "AuditEntityType" ADD VALUE 'MERCHANT_AUTOPAY_APPROVAL';
ALTER TYPE "AuditEntityType" ADD VALUE 'MERCHANT_RECURRING_INVOICE';

-- AlterTable UserBankSettings
ALTER TABLE "UserBankSettings" ADD COLUMN "paymentEngineNotificationPrefs" JSONB NOT NULL DEFAULT '{}';

-- AlterTable ScheduledPayment
ALTER TABLE "ScheduledPayment" ADD COLUMN "paymentChannel" "ScheduledPaymentChannel" NOT NULL DEFAULT 'TRANSFER';
ALTER TABLE "ScheduledPayment" ADD COLUMN "recipientCompanyId" TEXT;
ALTER TABLE "ScheduledPayment" ADD COLUMN "recipientUserId" TEXT;
CREATE INDEX "ScheduledPayment_paymentChannel_idx" ON "ScheduledPayment"("paymentChannel");
CREATE INDEX "ScheduledPayment_recipientCompanyId_idx" ON "ScheduledPayment"("recipientCompanyId");
CREATE INDEX "ScheduledPayment_recipientUserId_idx" ON "ScheduledPayment"("recipientUserId");
ALTER TABLE "ScheduledPayment" ADD CONSTRAINT "ScheduledPayment_recipientCompanyId_fkey" FOREIGN KEY ("recipientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledPayment" ADD CONSTRAINT "ScheduledPayment_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable ScheduledTransferExecution
ALTER TABLE "ScheduledTransferExecution" ADD COLUMN "paymentId" TEXT;
ALTER TABLE "ScheduledTransferExecution" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScheduledTransferExecution" ADD COLUMN "nextRetryAt" TIMESTAMP(3);
CREATE INDEX "ScheduledTransferExecution_nextRetryAt_idx" ON "ScheduledTransferExecution"("nextRetryAt");
ALTER TABLE "ScheduledTransferExecution" ADD CONSTRAINT "ScheduledTransferExecution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable MerchantAutopayApproval
CREATE TABLE "MerchantAutopayApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantCompanyId" TEXT NOT NULL,
    "fundingAccountId" TEXT NOT NULL,
    "maxInvoiceAmount" DECIMAL(18,2) NOT NULL,
    "confirmationRequiredAboveAmount" DECIMAL(18,2),
    "allowedFrequency" "PaymentFrequency" NOT NULL,
    "maxPaymentsPerMonth" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "allowRecurringInvoices" BOOLEAN NOT NULL DEFAULT true,
    "status" "MerchantAutopayApprovalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantAutopayApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MerchantAutopayApproval_userId_merchantCompanyId_fundingAccountId_key" ON "MerchantAutopayApproval"("userId", "merchantCompanyId", "fundingAccountId");
CREATE INDEX "MerchantAutopayApproval_userId_status_idx" ON "MerchantAutopayApproval"("userId", "status");
CREATE INDEX "MerchantAutopayApproval_merchantCompanyId_idx" ON "MerchantAutopayApproval"("merchantCompanyId");
ALTER TABLE "MerchantAutopayApproval" ADD CONSTRAINT "MerchantAutopayApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantAutopayApproval" ADD CONSTRAINT "MerchantAutopayApproval_merchantCompanyId_fkey" FOREIGN KEY ("merchantCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantAutopayApproval" ADD CONSTRAINT "MerchantAutopayApproval_fundingAccountId_fkey" FOREIGN KEY ("fundingAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MerchantRecurringInvoiceSchedule
CREATE TABLE "MerchantRecurringInvoiceSchedule" (
    "id" TEXT NOT NULL,
    "merchantCompanyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientCompanyId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL,
    "dayOfMonth" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoSendEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecurringInvoiceScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunDate" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRecurringInvoiceSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MerchantRecurringInvoiceSchedule_merchantCompanyId_status_idx" ON "MerchantRecurringInvoiceSchedule"("merchantCompanyId", "status");
CREATE INDEX "MerchantRecurringInvoiceSchedule_nextRunDate_idx" ON "MerchantRecurringInvoiceSchedule"("nextRunDate");
CREATE INDEX "MerchantRecurringInvoiceSchedule_recipientUserId_idx" ON "MerchantRecurringInvoiceSchedule"("recipientUserId");
CREATE INDEX "MerchantRecurringInvoiceSchedule_recipientCompanyId_idx" ON "MerchantRecurringInvoiceSchedule"("recipientCompanyId");
ALTER TABLE "MerchantRecurringInvoiceSchedule" ADD CONSTRAINT "MerchantRecurringInvoiceSchedule_merchantCompanyId_fkey" FOREIGN KEY ("merchantCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantRecurringInvoiceSchedule" ADD CONSTRAINT "MerchantRecurringInvoiceSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantRecurringInvoiceSchedule" ADD CONSTRAINT "MerchantRecurringInvoiceSchedule_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantRecurringInvoiceSchedule" ADD CONSTRAINT "MerchantRecurringInvoiceSchedule_recipientCompanyId_fkey" FOREIGN KEY ("recipientCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable MerchantInvoice
ALTER TABLE "MerchantInvoice" ADD COLUMN "recurringScheduleId" TEXT;
ALTER TABLE "MerchantInvoice" ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "MerchantInvoice_recurringScheduleId_idx" ON "MerchantInvoice"("recurringScheduleId");
ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_recurringScheduleId_fkey" FOREIGN KEY ("recurringScheduleId") REFERENCES "MerchantRecurringInvoiceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable MerchantInvoicePayment
ALTER TABLE "MerchantInvoicePayment" ADD COLUMN "isAutopay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MerchantInvoicePayment" ADD COLUMN "autopayApprovalId" TEXT;
