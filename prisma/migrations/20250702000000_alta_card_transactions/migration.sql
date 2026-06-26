-- CreateEnum
CREATE TYPE "AltaCardTransactionType" AS ENUM ('PURCHASE', 'ALTA_PAY', 'CASH_ADVANCE', 'PAYMENT', 'INTEREST', 'FEE', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "AltaCardTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "AltaCardTransaction" (
    "id" TEXT NOT NULL,
    "altaCardId" TEXT NOT NULL,
    "altaEmployeeCardId" TEXT,
    "type" "AltaCardTransactionType" NOT NULL,
    "status" "AltaCardTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "merchantCompanyId" TEXT,
    "relatedBankAccountId" TEXT,
    "relatedBankTransactionId" TEXT,
    "relatedAltaPayPaymentId" TEXT,
    "referenceCode" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversesTransactionId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AltaCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AltaCardTransaction_referenceCode_key" ON "AltaCardTransaction"("referenceCode");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_altaCardId_idx" ON "AltaCardTransaction"("altaCardId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_altaEmployeeCardId_idx" ON "AltaCardTransaction"("altaEmployeeCardId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_type_idx" ON "AltaCardTransaction"("type");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_status_idx" ON "AltaCardTransaction"("status");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_merchantCompanyId_idx" ON "AltaCardTransaction"("merchantCompanyId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_relatedBankTransactionId_idx" ON "AltaCardTransaction"("relatedBankTransactionId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_relatedAltaPayPaymentId_idx" ON "AltaCardTransaction"("relatedAltaPayPaymentId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_createdByUserId_idx" ON "AltaCardTransaction"("createdByUserId");

-- CreateIndex
CREATE INDEX "AltaCardTransaction_createdAt_idx" ON "AltaCardTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_altaCardId_fkey" FOREIGN KEY ("altaCardId") REFERENCES "AltaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_altaEmployeeCardId_fkey" FOREIGN KEY ("altaEmployeeCardId") REFERENCES "AltaEmployeeCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_merchantCompanyId_fkey" FOREIGN KEY ("merchantCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_relatedBankAccountId_fkey" FOREIGN KEY ("relatedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_relatedBankTransactionId_fkey" FOREIGN KEY ("relatedBankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaCardTransaction" ADD CONSTRAINT "AltaCardTransaction_reversesTransactionId_fkey" FOREIGN KEY ("reversesTransactionId") REFERENCES "AltaCardTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
