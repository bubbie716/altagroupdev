-- Alta Terminal scheduled/recurring market-order instructions (V1: whole shares, UTC times).

-- Unified instrument/venue enums (shared with crypto Phase 1; defaults preserve stock/TSE behavior).
CREATE TYPE "TerminalInstrumentKind" AS ENUM ('STOCK', 'CRYPTO');
CREATE TYPE "TerminalExecutionVenue" AS ENUM ('TSE', 'ALTA_CRYPTO');

CREATE TYPE "TerminalScheduledTradeScheduleType" AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE "TerminalScheduledTradeFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
CREATE TYPE "TerminalScheduledTradeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ENDED');
CREATE TYPE "TerminalScheduledTradeOccurrenceStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTED', 'SKIPPED', 'FAILED');
CREATE TYPE "TerminalScheduledTradeFailureCategory" AS ENUM (
    'NONE',
    'INSUFFICIENT_BUYING_POWER',
    'INSUFFICIENT_HOLDINGS',
    'MARKET_UNAVAILABLE',
    'TSE_UNAVAILABLE',
    'CONSENT_REQUIRED',
    'PORTFOLIO_ARCHIVED',
    'PORTFOLIO_RESTRICTED',
    'SYMBOL_UNAVAILABLE',
    'VALIDATION_FAILED',
    'AUTHORIZATION_FAILED',
    'TRANSIENT_ERROR',
    'OTHER'
);

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_INSTRUCTION';

ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_CREATED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_PAUSED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_RESUMED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_CANCELLED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_ORDER_SUBMITTED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_ATTEMPT_SKIPPED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_ATTEMPT_FAILED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_COMPLETED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'TERMINAL_SCHEDULED_TRADE_ENDED';

CREATE TABLE "TerminalScheduledTradeInstruction" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "symbol" TEXT NOT NULL,
    "instrumentKind" "TerminalInstrumentKind" NOT NULL DEFAULT 'STOCK',
    "executionVenue" "TerminalExecutionVenue" NOT NULL DEFAULT 'TSE',
    "side" "TerminalOrderSide" NOT NULL,
    "orderType" "TerminalOrderType" NOT NULL DEFAULT 'MARKET',
    "quantity" DECIMAL(28,8) NOT NULL,
    "scheduleType" "TerminalScheduledTradeScheduleType" NOT NULL,
    "frequency" "TerminalScheduledTradeFrequency",
    "startAt" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "timeZonePolicy" TEXT NOT NULL DEFAULT 'UTC',
    "status" "TerminalScheduledTradeStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastAttemptStatus" "TerminalScheduledTradeOccurrenceStatus",
    "lastFailureCategory" "TerminalScheduledTradeFailureCategory" NOT NULL DEFAULT 'NONE',
    "lastFailureSummary" TEXT,
    "lastSubmittedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TerminalScheduledTradeInstruction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TerminalScheduledTradeInstruction_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "TerminalScheduledTradeOccurrence" (
    "id" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "scheduledRunAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "TerminalScheduledTradeOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "terminalOrderId" TEXT,
    "externalTseOrderId" TEXT,
    "failureCategory" "TerminalScheduledTradeFailureCategory",
    "customerFailureSummary" TEXT,
    "technicalDetails" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalScheduledTradeOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TerminalScheduledTradeOccurrence_idempotencyKey_key" ON "TerminalScheduledTradeOccurrence"("idempotencyKey");
CREATE UNIQUE INDEX "TerminalScheduledTradeOccurrence_instructionId_scheduledRunAt_key" ON "TerminalScheduledTradeOccurrence"("instructionId", "scheduledRunAt");

CREATE INDEX "TerminalScheduledTradeInstruction_status_nextRunAt_idx" ON "TerminalScheduledTradeInstruction"("status", "nextRunAt");
CREATE INDEX "TerminalScheduledTradeInstruction_portfolioId_idx" ON "TerminalScheduledTradeInstruction"("portfolioId");
CREATE INDEX "TerminalScheduledTradeInstruction_createdByUserId_idx" ON "TerminalScheduledTradeInstruction"("createdByUserId");
CREATE INDEX "TerminalScheduledTradeInstruction_companyId_idx" ON "TerminalScheduledTradeInstruction"("companyId");
CREATE INDEX "TerminalScheduledTradeInstruction_symbol_idx" ON "TerminalScheduledTradeInstruction"("symbol");
CREATE INDEX "TerminalScheduledTradeInstruction_instrumentKind_executionVenue_idx" ON "TerminalScheduledTradeInstruction"("instrumentKind", "executionVenue");

CREATE INDEX "TerminalScheduledTradeOccurrence_status_idx" ON "TerminalScheduledTradeOccurrence"("status");
CREATE INDEX "TerminalScheduledTradeOccurrence_nextRetryAt_idx" ON "TerminalScheduledTradeOccurrence"("nextRetryAt");
CREATE INDEX "TerminalScheduledTradeOccurrence_instructionId_status_idx" ON "TerminalScheduledTradeOccurrence"("instructionId", "status");

ALTER TABLE "TerminalScheduledTradeInstruction" ADD CONSTRAINT "TerminalScheduledTradeInstruction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "TerminalPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalScheduledTradeInstruction" ADD CONSTRAINT "TerminalScheduledTradeInstruction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalScheduledTradeInstruction" ADD CONSTRAINT "TerminalScheduledTradeInstruction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TerminalScheduledTradeInstruction" ADD CONSTRAINT "TerminalScheduledTradeInstruction_lastSubmittedOrderId_fkey" FOREIGN KEY ("lastSubmittedOrderId") REFERENCES "TerminalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TerminalScheduledTradeOccurrence" ADD CONSTRAINT "TerminalScheduledTradeOccurrence_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "TerminalScheduledTradeInstruction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalScheduledTradeOccurrence" ADD CONSTRAINT "TerminalScheduledTradeOccurrence_terminalOrderId_fkey" FOREIGN KEY ("terminalOrderId") REFERENCES "TerminalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
