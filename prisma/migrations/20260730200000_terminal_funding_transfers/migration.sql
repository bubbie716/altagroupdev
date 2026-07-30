-- Alta Bank ↔ Alta Terminal funding transfers (internal cash only; not TSE custody).

CREATE TYPE "TerminalFundingDirection" AS ENUM ('BANK_TO_TERMINAL', 'TERMINAL_TO_BANK');
CREATE TYPE "TerminalFundingStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

ALTER TYPE "TransferGroupType" ADD VALUE IF NOT EXISTS 'TERMINAL_FUNDING';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_FUNDING_TRANSFER';

CREATE TABLE "TerminalFundingTransfer" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "direction" "TerminalFundingDirection" NOT NULL,
    "status" "TerminalFundingStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "bankAccountId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerCompanyId" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "bankTransactionId" TEXT,
    "transferGroupId" TEXT,
    "terminalLedgerEntryId" TEXT,
    "terminalActivityId" TEXT,
    "operatorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "TerminalFundingTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TerminalFundingTransfer_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "TerminalFundingTransfer_referenceCode_key" ON "TerminalFundingTransfer"("referenceCode");
CREATE UNIQUE INDEX "TerminalFundingTransfer_bankTransactionId_key" ON "TerminalFundingTransfer"("bankTransactionId");
CREATE UNIQUE INDEX "TerminalFundingTransfer_transferGroupId_key" ON "TerminalFundingTransfer"("transferGroupId");
CREATE UNIQUE INDEX "TerminalFundingTransfer_terminalLedgerEntryId_key" ON "TerminalFundingTransfer"("terminalLedgerEntryId");
CREATE UNIQUE INDEX "TerminalFundingTransfer_terminalActivityId_key" ON "TerminalFundingTransfer"("terminalActivityId");
CREATE UNIQUE INDEX "TerminalFundingTransfer_initiatedByUserId_idempotencyKey_key" ON "TerminalFundingTransfer"("initiatedByUserId", "idempotencyKey");

CREATE INDEX "TerminalFundingTransfer_bankAccountId_createdAt_idx" ON "TerminalFundingTransfer"("bankAccountId", "createdAt");
CREATE INDEX "TerminalFundingTransfer_portfolioId_createdAt_idx" ON "TerminalFundingTransfer"("portfolioId", "createdAt");
CREATE INDEX "TerminalFundingTransfer_ownerUserId_createdAt_idx" ON "TerminalFundingTransfer"("ownerUserId", "createdAt");
CREATE INDEX "TerminalFundingTransfer_ownerCompanyId_createdAt_idx" ON "TerminalFundingTransfer"("ownerCompanyId", "createdAt");
CREATE INDEX "TerminalFundingTransfer_status_createdAt_idx" ON "TerminalFundingTransfer"("status", "createdAt");
CREATE INDEX "TerminalFundingTransfer_direction_status_idx" ON "TerminalFundingTransfer"("direction", "status");
CREATE INDEX "TerminalFundingTransfer_createdAt_idx" ON "TerminalFundingTransfer"("createdAt");

ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_transferGroupId_fkey" FOREIGN KEY ("transferGroupId") REFERENCES "TransferGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_terminalLedgerEntryId_fkey" FOREIGN KEY ("terminalLedgerEntryId") REFERENCES "TerminalCashLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalFundingTransfer" ADD CONSTRAINT "TerminalFundingTransfer_terminalActivityId_fkey" FOREIGN KEY ("terminalActivityId") REFERENCES "TerminalPortfolioActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
