-- Payment Links (Alta Bank V2 Lite)

CREATE TYPE "PaymentLinkAmountType" AS ENUM ('FIXED', 'OPEN');
CREATE TYPE "PaymentLinkUsageType" AS ENUM ('ONE_TIME', 'REUSABLE');
CREATE TYPE "PaymentLinkStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentLinkPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "PaymentLinkEventType" AS ENUM ('CREATED', 'UPDATED', 'PAUSED', 'ACTIVATED', 'CANCELLED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'EXPIRED');

ALTER TYPE "PaymentType" ADD VALUE 'PAYMENT_LINK';
ALTER TYPE "TransferGroupType" ADD VALUE 'PAYMENT_LINK';
ALTER TYPE "AuditEntityType" ADD VALUE 'PAYMENT_LINK';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_LINK_PAID';
ALTER TYPE "UserNotificationType" ADD VALUE 'PAYMENT_LINK_RECEIPT';

CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "merchantCompanyId" TEXT NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "internalMemo" TEXT,
    "amountType" "PaymentLinkAmountType" NOT NULL,
    "usageType" "PaymentLinkUsageType" NOT NULL,
    "amount" DECIMAL(18,2),
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "paymentCount" INTEGER NOT NULL DEFAULT 0,
    "totalCollected" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLinkPayment" (
    "id" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PaymentLinkPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "paymentId" TEXT,
    "transferGroupId" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "payerLabel" TEXT,
    "fundingSource" JSONB NOT NULL,
    "failureReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLinkPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLinkEvent" (
    "id" TEXT NOT NULL,
    "paymentLinkId" TEXT NOT NULL,
    "eventType" "PaymentLinkEventType" NOT NULL,
    "actorUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLinkEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentLink_slug_key" ON "PaymentLink"("slug");
CREATE UNIQUE INDEX "PaymentLink_referenceCode_key" ON "PaymentLink"("referenceCode");
CREATE INDEX "PaymentLink_merchantCompanyId_status_idx" ON "PaymentLink"("merchantCompanyId", "status");
CREATE INDEX "PaymentLink_expiresAt_status_idx" ON "PaymentLink"("expiresAt", "status");
CREATE INDEX "PaymentLink_createdAt_idx" ON "PaymentLink"("createdAt");

CREATE UNIQUE INDEX "PaymentLinkPayment_idempotencyKey_key" ON "PaymentLinkPayment"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentLinkPayment_paymentId_key" ON "PaymentLinkPayment"("paymentId");
CREATE INDEX "PaymentLinkPayment_paymentLinkId_idx" ON "PaymentLinkPayment"("paymentLinkId");
CREATE INDEX "PaymentLinkPayment_status_idx" ON "PaymentLinkPayment"("status");

CREATE INDEX "PaymentLinkEvent_paymentLinkId_createdAt_idx" ON "PaymentLinkEvent"("paymentLinkId", "createdAt");

ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_merchantCompanyId_fkey" FOREIGN KEY ("merchantCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentLinkPayment" ADD CONSTRAINT "PaymentLinkPayment_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLinkPayment" ADD CONSTRAINT "PaymentLinkPayment_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentLinkEvent" ADD CONSTRAINT "PaymentLinkEvent_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
