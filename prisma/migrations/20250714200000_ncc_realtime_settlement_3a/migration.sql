-- NCC Sprint 3A — Real-time settlement execution, Terminal cash ledger, audit isolation

-- CreateEnum
CREATE TYPE "SettlementExecutionStatus" AS ENUM ('NOT_STARTED', 'VALIDATING', 'PREPARING_SOURCE', 'SOURCE_PREPARED', 'POSTING_NCC_LEDGER', 'NCC_LEDGER_POSTED', 'COMMITTING_SOURCE', 'SOURCE_COMMITTED', 'CREDITING_DESTINATION', 'DESTINATION_CREDITED', 'COMPLETED', 'RETRY_PENDING', 'MANUAL_REVIEW', 'COMPENSATING', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementExecutionStep" AS ENUM ('VALIDATE', 'PREPARE_SOURCE', 'POST_NCC_LEDGER', 'COMMIT_SOURCE', 'CREDIT_DESTINATION', 'FINALIZE', 'IDLE');

-- CreateEnum
CREATE TYPE "TerminalCashAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TerminalCashEntryType" AS ENUM ('FUNDING_CREDIT', 'WITHDRAWAL_DEBIT', 'RESERVATION', 'RESERVATION_RELEASE', 'TRADE_RESERVATION', 'REVERSAL_CREDIT', 'REVERSAL_DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TerminalTransferRequestStatus" AS ENUM ('CREATED', 'PREPARING', 'NCC_POSTED', 'SOURCE_COMMITTED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "SettlementOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementReconciliationStatus" AS ENUM ('MATCHED', 'PENDING', 'MISMATCH', 'MISSING_SOURCE', 'MISSING_DESTINATION', 'DUPLICATE', 'STALE_RESERVATION', 'MANUAL_REVIEW', 'RESOLVED');

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_EXECUTION';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CASH_ACCOUNT';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_CASH_ENTRY';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_FUNDING_REQUEST';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_WITHDRAWAL_REQUEST';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'SETTLEMENT_RECONCILIATION';

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

ALTER TABLE "BankAccountHold" ADD COLUMN IF NOT EXISTS "nccOperationKey" TEXT;
ALTER TABLE "BankAccountHold" ADD COLUMN IF NOT EXISTS "settlementInstructionId" TEXT;

CREATE TABLE IF NOT EXISTS "SettlementExecution" (
    "id" TEXT NOT NULL,
    "settlementInstructionId" TEXT NOT NULL,
    "status" "SettlementExecutionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" "SettlementExecutionStep" NOT NULL DEFAULT 'VALIDATE',
    "sourceAccountReference" TEXT,
    "destinationAccountReference" TEXT,
    "sourcePreparationReference" TEXT,
    "sourceCommitReference" TEXT,
    "destinationCreditReference" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SettlementExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TerminalCashAccount" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerCompanyId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "ledgerBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reservedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "TerminalCashAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TerminalCashAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TerminalCashEntry" (
    "id" TEXT NOT NULL,
    "terminalCashAccountId" TEXT NOT NULL,
    "entryType" "TerminalCashEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "availableBefore" DECIMAL(18,2) NOT NULL,
    "availableAfter" DECIMAL(18,2) NOT NULL,
    "settlementInstructionId" TEXT,
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TerminalCashEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TerminalFundingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceBankAccountId" TEXT NOT NULL,
    "terminalCashAccountId" TEXT NOT NULL,
    "settlementInstructionId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "status" "TerminalTransferRequestStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "TerminalFundingRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TerminalWithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "terminalCashAccountId" TEXT NOT NULL,
    "destinationBankAccountId" TEXT NOT NULL,
    "settlementInstructionId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FLR',
    "status" "TerminalTransferRequestStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "TerminalWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SettlementOutboxEvent" (
    "id" TEXT NOT NULL,
    "settlementInstructionId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "SettlementOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "SettlementOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SettlementReconciliation" (
    "id" TEXT NOT NULL,
    "settlementInstructionId" TEXT NOT NULL,
    "status" "SettlementReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "findings" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SettlementReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SettlementExecution_settlementInstructionId_key" ON "SettlementExecution"("settlementInstructionId");
CREATE INDEX IF NOT EXISTS "SettlementExecution_status_nextRetryAt_idx" ON "SettlementExecution"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "SettlementExecution_updatedAt_idx" ON "SettlementExecution"("updatedAt");
CREATE INDEX IF NOT EXISTS "TerminalCashAccount_ownerUserId_idx" ON "TerminalCashAccount"("ownerUserId");
CREATE INDEX IF NOT EXISTS "TerminalCashAccount_ownerCompanyId_idx" ON "TerminalCashAccount"("ownerCompanyId");
CREATE INDEX IF NOT EXISTS "TerminalCashAccount_status_idx" ON "TerminalCashAccount"("status");
CREATE INDEX IF NOT EXISTS "TerminalCashAccount_currency_idx" ON "TerminalCashAccount"("currency");
CREATE UNIQUE INDEX IF NOT EXISTS "TerminalCashEntry_idempotencyKey_key" ON "TerminalCashEntry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TerminalCashEntry_terminalCashAccountId_createdAt_idx" ON "TerminalCashEntry"("terminalCashAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "TerminalCashEntry_settlementInstructionId_idx" ON "TerminalCashEntry"("settlementInstructionId");
CREATE UNIQUE INDEX IF NOT EXISTS "TerminalFundingRequest_idempotencyKey_key" ON "TerminalFundingRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TerminalFundingRequest_userId_createdAt_idx" ON "TerminalFundingRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TerminalFundingRequest_status_idx" ON "TerminalFundingRequest"("status");
CREATE INDEX IF NOT EXISTS "TerminalFundingRequest_sourceBankAccountId_idx" ON "TerminalFundingRequest"("sourceBankAccountId");
CREATE INDEX IF NOT EXISTS "TerminalFundingRequest_settlementInstructionId_idx" ON "TerminalFundingRequest"("settlementInstructionId");
CREATE UNIQUE INDEX IF NOT EXISTS "TerminalWithdrawalRequest_idempotencyKey_key" ON "TerminalWithdrawalRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "TerminalWithdrawalRequest_userId_createdAt_idx" ON "TerminalWithdrawalRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TerminalWithdrawalRequest_status_idx" ON "TerminalWithdrawalRequest"("status");
CREATE INDEX IF NOT EXISTS "TerminalWithdrawalRequest_destinationBankAccountId_idx" ON "TerminalWithdrawalRequest"("destinationBankAccountId");
CREATE INDEX IF NOT EXISTS "TerminalWithdrawalRequest_settlementInstructionId_idx" ON "TerminalWithdrawalRequest"("settlementInstructionId");
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementOutboxEvent_dedupeKey_key" ON "SettlementOutboxEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "SettlementOutboxEvent_status_nextRetryAt_idx" ON "SettlementOutboxEvent"("status", "nextRetryAt");
CREATE INDEX IF NOT EXISTS "SettlementOutboxEvent_settlementInstructionId_idx" ON "SettlementOutboxEvent"("settlementInstructionId");
CREATE INDEX IF NOT EXISTS "SettlementReconciliation_settlementInstructionId_createdAt_idx" ON "SettlementReconciliation"("settlementInstructionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SettlementReconciliation_status_idx" ON "SettlementReconciliation"("status");
CREATE INDEX IF NOT EXISTS "AuditLog_institutionId_idx" ON "AuditLog"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BankAccountHold_nccOperationKey_key" ON "BankAccountHold"("nccOperationKey");
CREATE INDEX IF NOT EXISTS "BankAccountHold_settlementInstructionId_idx" ON "BankAccountHold"("settlementInstructionId");

DO $$ BEGIN
  ALTER TABLE "SettlementExecution" ADD CONSTRAINT "SettlementExecution_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalCashAccount" ADD CONSTRAINT "TerminalCashAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalCashAccount" ADD CONSTRAINT "TerminalCashAccount_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalCashEntry" ADD CONSTRAINT "TerminalCashEntry_terminalCashAccountId_fkey" FOREIGN KEY ("terminalCashAccountId") REFERENCES "TerminalCashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalCashEntry" ADD CONSTRAINT "TerminalCashEntry_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalFundingRequest" ADD CONSTRAINT "TerminalFundingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalFundingRequest" ADD CONSTRAINT "TerminalFundingRequest_terminalCashAccountId_fkey" FOREIGN KEY ("terminalCashAccountId") REFERENCES "TerminalCashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalFundingRequest" ADD CONSTRAINT "TerminalFundingRequest_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalWithdrawalRequest" ADD CONSTRAINT "TerminalWithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalWithdrawalRequest" ADD CONSTRAINT "TerminalWithdrawalRequest_terminalCashAccountId_fkey" FOREIGN KEY ("terminalCashAccountId") REFERENCES "TerminalCashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminalWithdrawalRequest" ADD CONSTRAINT "TerminalWithdrawalRequest_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SettlementOutboxEvent" ADD CONSTRAINT "SettlementOutboxEvent_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SettlementReconciliation" ADD CONSTRAINT "SettlementReconciliation_settlementInstructionId_fkey" FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
