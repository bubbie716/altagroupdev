-- NCC Sprint 3A.1 — Financial Hardening & Closeout

ALTER TYPE "SettlementExecutionStatus" ADD VALUE 'COMPENSATED';
ALTER TYPE "SettlementReconciliationStatus" ADD VALUE 'COMPENSATED';
ALTER TYPE "AuditEntityType" ADD VALUE 'SETTLEMENT_COMPENSATION';

ALTER TABLE "TerminalCashAccount"
  ADD CONSTRAINT "TerminalCashAccount_exactly_one_owner_check"
  CHECK (
    ("ownerUserId" IS NOT NULL AND "ownerCompanyId" IS NULL)
    OR ("ownerUserId" IS NULL AND "ownerCompanyId" IS NOT NULL)
  );

CREATE UNIQUE INDEX "TerminalCashAccount_ownerUserId_currency_unique"
  ON "TerminalCashAccount" ("ownerUserId", "currency")
  WHERE "ownerUserId" IS NOT NULL;

CREATE UNIQUE INDEX "TerminalCashAccount_ownerCompanyId_currency_unique"
  ON "TerminalCashAccount" ("ownerCompanyId", "currency")
  WHERE "ownerCompanyId" IS NOT NULL;

CREATE TABLE "SettlementCompensation" (
    "id" TEXT NOT NULL,
    "settlementInstructionId" TEXT NOT NULL,
    "settlementExecutionId" TEXT NOT NULL,
    "compensatingInstructionId" TEXT,
    "sourceRestoreReference" TEXT,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementCompensation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementCompensation_settlementInstructionId_key"
  ON "SettlementCompensation"("settlementInstructionId");

CREATE UNIQUE INDEX "SettlementCompensation_settlementExecutionId_key"
  ON "SettlementCompensation"("settlementExecutionId");

CREATE INDEX "SettlementCompensation_actorUserId_idx"
  ON "SettlementCompensation"("actorUserId");

CREATE INDEX "SettlementCompensation_createdAt_idx"
  ON "SettlementCompensation"("createdAt");

ALTER TABLE "SettlementCompensation"
  ADD CONSTRAINT "SettlementCompensation_settlementInstructionId_fkey"
  FOREIGN KEY ("settlementInstructionId") REFERENCES "SettlementInstruction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementCompensation"
  ADD CONSTRAINT "SettlementCompensation_settlementExecutionId_fkey"
  FOREIGN KEY ("settlementExecutionId") REFERENCES "SettlementExecution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SettlementCompensation"
  ADD CONSTRAINT "SettlementCompensation_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
