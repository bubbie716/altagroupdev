-- CreateEnum
CREATE TYPE "AltaCardStatementStatus" AS ENUM ('OPEN', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID');

-- AlterTable
ALTER TABLE "AltaCard" ADD COLUMN "currentBillingCycleStart" TIMESTAMP(3),
ADD COLUMN "currentBillingCycleEnd" TIMESTAMP(3),
ADD COLUMN "currentStatementId" TEXT,
ADD COLUMN "lastStatementDate" TIMESTAMP(3),
ADD COLUMN "nextStatementDate" TIMESTAMP(3),
ADD COLUMN "paymentDueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AltaCardTransaction" ADD COLUMN "altaCardStatementId" TEXT;

-- CreateTable
CREATE TABLE "AltaCardStatement" (
    "id" TEXT NOT NULL,
    "altaCardId" TEXT NOT NULL,
    "statementNumber" INTEGER NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "statementDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "previousBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "purchases" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestCharged" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feesCharged" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statementBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimumPayment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "endingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "AltaCardStatementStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AltaCard_currentStatementId_key" ON "AltaCard"("currentStatementId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_altaCardStatementId_idx" ON "AltaCardTransaction"("altaCardStatementId");

-- CreateIndex
CREATE INDEX "AltaCardStatement_altaCardId_idx" ON "AltaCardStatement"("altaCardId");

-- CreateIndex
CREATE INDEX "AltaCardStatement_status_idx" ON "AltaCardStatement"("status");

-- CreateIndex
CREATE INDEX "AltaCardStatement_dueDate_idx" ON "AltaCardStatement"("dueDate");

-- CreateIndex
CREATE INDEX "AltaCardStatement_billingPeriodEnd_idx" ON "AltaCardStatement"("billingPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AltaCardStatement_altaCardId_statementNumber_key" ON "AltaCardStatement"("altaCardId", "statementNumber");

-- AddForeignKey
ALTER TABLE "AltaCard" ADD CONSTRAINT "AltaCard_currentStatementId_fkey" FOREIGN KEY ("currentStatementId") REFERENCES "AltaCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_altaCardStatementId_fkey" FOREIGN KEY ("altaCardStatementId") REFERENCES "AltaCardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardStatement" ADD CONSTRAINT "AltaCardStatement_altaCardId_fkey" FOREIGN KEY ("altaCardId") REFERENCES "AltaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
