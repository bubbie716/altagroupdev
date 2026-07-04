-- Merchant Invoices V2 Lite

CREATE TYPE "MerchantInvoiceStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'VIEWED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'VOIDED'
);

CREATE TYPE "MerchantInvoicePaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TYPE "MerchantInvoiceEventType" AS ENUM (
  'CREATED',
  'UPDATED',
  'SENT',
  'VIEWED',
  'REMINDER_SENT',
  'PAYMENT_INITIATED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FAILED',
  'CANCELLED',
  'VOIDED',
  'OVERDUE_MARKED'
);

ALTER TYPE "AuditEntityType" ADD VALUE 'MERCHANT_INVOICE';
ALTER TYPE "PaymentType" ADD VALUE 'MERCHANT_INVOICE';
ALTER TYPE "TransferGroupType" ADD VALUE 'MERCHANT_INVOICE';

ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_RECEIVED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_REMINDER';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_PAID';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_CANCELLED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_SENT';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_VIEWED';
ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_INVOICE_OVERDUE';

CREATE TABLE "MerchantInvoice" (
  "id" TEXT NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "merchantCompanyId" TEXT NOT NULL,
  "destinationAccountId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "recipientDiscordId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'FLR',
  "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(18,2),
  "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "memo" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "MerchantInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "lastReminderSentAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantInvoiceLineItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "unitAmount" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MerchantInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantInvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "MerchantInvoicePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "paymentId" TEXT,
  "transferGroupId" TEXT,
  "initiatedByUserId" TEXT NOT NULL,
  "fundingSource" JSONB NOT NULL,
  "failureReason" TEXT,
  "source" TEXT NOT NULL DEFAULT 'website',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "MerchantInvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantInvoiceEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "eventType" "MerchantInvoiceEventType" NOT NULL,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'website',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MerchantInvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantInvoice_referenceCode_key" ON "MerchantInvoice"("referenceCode");
CREATE UNIQUE INDEX "MerchantInvoice_paymentId_key" ON "MerchantInvoice"("paymentId");
CREATE INDEX "MerchantInvoice_merchantCompanyId_status_idx" ON "MerchantInvoice"("merchantCompanyId", "status");
CREATE INDEX "MerchantInvoice_recipientUserId_status_idx" ON "MerchantInvoice"("recipientUserId", "status");
CREATE INDEX "MerchantInvoice_dueDate_status_idx" ON "MerchantInvoice"("dueDate", "status");
CREATE INDEX "MerchantInvoice_createdAt_idx" ON "MerchantInvoice"("createdAt");

CREATE INDEX "MerchantInvoiceLineItem_invoiceId_idx" ON "MerchantInvoiceLineItem"("invoiceId");

CREATE UNIQUE INDEX "MerchantInvoicePayment_idempotencyKey_key" ON "MerchantInvoicePayment"("idempotencyKey");
CREATE INDEX "MerchantInvoicePayment_invoiceId_idx" ON "MerchantInvoicePayment"("invoiceId");
CREATE INDEX "MerchantInvoicePayment_status_idx" ON "MerchantInvoicePayment"("status");

CREATE INDEX "MerchantInvoiceEvent_invoiceId_createdAt_idx" ON "MerchantInvoiceEvent"("invoiceId", "createdAt");

ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_merchantCompanyId_fkey"
  FOREIGN KEY ("merchantCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_destinationAccountId_fkey"
  FOREIGN KEY ("destinationAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantInvoice" ADD CONSTRAINT "MerchantInvoice_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MerchantInvoiceLineItem" ADD CONSTRAINT "MerchantInvoiceLineItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "MerchantInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantInvoicePayment" ADD CONSTRAINT "MerchantInvoicePayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "MerchantInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantInvoicePayment" ADD CONSTRAINT "MerchantInvoicePayment_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantInvoiceEvent" ADD CONSTRAINT "MerchantInvoiceEvent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "MerchantInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
