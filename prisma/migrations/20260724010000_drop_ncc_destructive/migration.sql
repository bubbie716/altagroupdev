-- DESTRUCTIVE MIGRATION: Drop Newport Clearing Corporation (NCC) database objects.
-- DO NOT apply automatically to production without manual review.
-- This migration was created for review only; it must not be run as part of routine deploys until approved.

-- ---------------------------------------------------------------------------
-- Shared tables: drop NCC-only columns and indexes
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "BankAccountHold_nccOperationKey_key";
ALTER TABLE "BankAccountHold" DROP COLUMN IF EXISTS "nccOperationKey";

DROP INDEX IF EXISTS "BankAccountHold_settlementInstructionId_idx";
ALTER TABLE "BankAccountHold" DROP COLUMN IF EXISTS "settlementInstructionId";

DROP INDEX IF EXISTS "AuditLog_institutionId_idx";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "institutionId";

-- Remove audit rows for entity types that are being retired with the NCC stack.
DELETE FROM "AuditLog"
WHERE "entityType"::text IN (
  'FINANCIAL_INSTITUTION',
  'ROUTING_NUMBER',
  'SETTLEMENT_ACCOUNT',
  'SETTLEMENT_INSTRUCTION',
  'SETTLEMENT_ENTRY',
  'INSTITUTION_MEMBER',
  'SETTLEMENT_EXECUTION',
  'TERMINAL_CASH_ACCOUNT',
  'TERMINAL_CASH_ENTRY',
  'TERMINAL_FUNDING_REQUEST',
  'TERMINAL_WITHDRAWAL_REQUEST',
  'SETTLEMENT_RECONCILIATION',
  'SETTLEMENT_COMPENSATION',
  'NCC_API_CREDENTIAL',
  'NCC_WEBHOOK_ENDPOINT',
  'NCC_WEBHOOK_EVENT',
  'NCC_WEBHOOK_DELIVERY',
  'NCC_API_REQUEST_LOG',
  'NCC_REVERSAL_REQUEST',
  'NCC_PARTICIPANT_APPLICATION',
  'NCC_PARTICIPANT_DOCUMENT',
  'NCC_LIQUIDITY_OPERATION',
  'NCC_STAFF_MEMBERSHIP',
  'NCC_NETWORK_CONTROL',
  'NCC_TRANSFER_RETURN',
  'NCC_EMERGENCY_SUSPENSION',
  'NCC_RISK_POLICY',
  'NCC_RISK_DECISION',
  'NCC_OPERATIONAL_ALERT',
  'NCC_WORKER_LOCK'
);

-- Recreate AuditEntityType without settlement / NCC values (Postgres cannot DROP VALUE).
CREATE TYPE "AuditEntityType_new" AS ENUM (
  'USER',
  'BANK_ACCOUNT',
  'BANK_TRANSACTION',
  'COMPANY',
  'LOAN',
  'LOAN_APPLICATION',
  'DEAL_ROOM',
  'SCHEDULED_PAYMENT',
  'PAYROLL_RUN',
  'STATEMENT',
  'PLATFORM',
  'ALTA_CARD',
  'MERCHANT_INVOICE',
  'PAYMENT_LINK',
  'MERCHANT_AUTOPAY_APPROVAL',
  'MERCHANT_RECURRING_INVOICE'
);

ALTER TABLE "AuditLog"
  ALTER COLUMN "entityType" TYPE "AuditEntityType_new"
  USING ("entityType"::text::"AuditEntityType_new");

DROP TYPE "AuditEntityType";
ALTER TYPE "AuditEntityType_new" RENAME TO "AuditEntityType";

-- ---------------------------------------------------------------------------
-- NCC portal / API tables (dependent objects first)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "NccWebhookDelivery" CASCADE;
DROP TABLE IF EXISTS "NccCertificationCheck" CASCADE;
DROP TABLE IF EXISTS "NccAccountDirectoryEntry" CASCADE;
DROP TABLE IF EXISTS "NccParticipantApplicationTransition" CASCADE;
DROP TABLE IF EXISTS "NccParticipantApplicationNote" CASCADE;
DROP TABLE IF EXISTS "NccParticipantDocument" CASCADE;
DROP TABLE IF EXISTS "NccLiquidityOperation" CASCADE;
DROP TABLE IF EXISTS "NccApiRequestLog" CASCADE;
DROP TABLE IF EXISTS "NccWebhookEvent" CASCADE;
DROP TABLE IF EXISTS "NccSettlementReversalRequest" CASCADE;
DROP TABLE IF EXISTS "NccTransferReturn" CASCADE;
DROP TABLE IF EXISTS "NccCertificationRun" CASCADE;
DROP TABLE IF EXISTS "NccAccountDirectoryVersion" CASCADE;
DROP TABLE IF EXISTS "NccParticipantConnector" CASCADE;
DROP TABLE IF EXISTS "NccParticipantApplication" CASCADE;
DROP TABLE IF EXISTS "NccApiCredential" CASCADE;
DROP TABLE IF EXISTS "NccWebhookEndpoint" CASCADE;
DROP TABLE IF EXISTS "NccApiRateLimitBucket" CASCADE;
DROP TABLE IF EXISTS "NccStaffMembership" CASCADE;
DROP TABLE IF EXISTS "NccNetworkControl" CASCADE;
DROP TABLE IF EXISTS "NccEmergencySuspension" CASCADE;
DROP TABLE IF EXISTS "NccInstitutionRiskPolicy" CASCADE;
DROP TABLE IF EXISTS "NccRiskDecision" CASCADE;
DROP TABLE IF EXISTS "NccDailyRiskUsage" CASCADE;
DROP TABLE IF EXISTS "NccOperationalAlert" CASCADE;
DROP TABLE IF EXISTS "NccWorkerLock" CASCADE;

-- ---------------------------------------------------------------------------
-- NCC settlement / terminal clearing stack
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "SettlementCompensation" CASCADE;
DROP TABLE IF EXISTS "SettlementExecution" CASCADE;
DROP TABLE IF EXISTS "SettlementReconciliation" CASCADE;
DROP TABLE IF EXISTS "SettlementOutboxEvent" CASCADE;
DROP TABLE IF EXISTS "TerminalCashEntry" CASCADE;
DROP TABLE IF EXISTS "TerminalFundingRequest" CASCADE;
DROP TABLE IF EXISTS "TerminalWithdrawalRequest" CASCADE;
DROP TABLE IF EXISTS "SettlementEntry" CASCADE;
DROP TABLE IF EXISTS "SettlementReversal" CASCADE;
DROP TABLE IF EXISTS "SettlementInstruction" CASCADE;
DROP TABLE IF EXISTS "SettlementAccount" CASCADE;
DROP TABLE IF EXISTS "InstitutionMember" CASCADE;
DROP TABLE IF EXISTS "RoutingNumber" CASCADE;
DROP TABLE IF EXISTS "TerminalCashAccount" CASCADE;
DROP TABLE IF EXISTS "FinancialInstitution" CASCADE;

-- ---------------------------------------------------------------------------
-- Enums (tables dropped above; CASCADE clears remaining dependencies)
-- ---------------------------------------------------------------------------

DROP TYPE IF EXISTS "NccParticipantApplicationStatus" CASCADE;
DROP TYPE IF EXISTS "NccLegacyFloatReviewStatus" CASCADE;
DROP TYPE IF EXISTS "NccLiquidityOperationType" CASCADE;
DROP TYPE IF EXISTS "NccLiquidityOperationStatus" CASCADE;
DROP TYPE IF EXISTS "NccParticipantDocumentStatus" CASCADE;
DROP TYPE IF EXISTS "NccApiCredentialStatus" CASCADE;
DROP TYPE IF EXISTS "NccApiEnvironment" CASCADE;
DROP TYPE IF EXISTS "NccWebhookEndpointStatus" CASCADE;
DROP TYPE IF EXISTS "NccWebhookDeliveryStatus" CASCADE;
DROP TYPE IF EXISTS "NccReversalRequestStatus" CASCADE;
DROP TYPE IF EXISTS "NccConnectorMode" CASCADE;
DROP TYPE IF EXISTS "NccConnectorStatus" CASCADE;
DROP TYPE IF EXISTS "NccConnectorCertificationStatus" CASCADE;
DROP TYPE IF EXISTS "NccDirectoryVersionStatus" CASCADE;
DROP TYPE IF EXISTS "NccDirectoryEntryStatus" CASCADE;
DROP TYPE IF EXISTS "NccCertificationRunStatus" CASCADE;
DROP TYPE IF EXISTS "NccCertificationCheckStatus" CASCADE;
DROP TYPE IF EXISTS "NccStaffRole" CASCADE;
DROP TYPE IF EXISTS "NccStaffMembershipStatus" CASCADE;
DROP TYPE IF EXISTS "NccNetworkSettlementMode" CASCADE;
DROP TYPE IF EXISTS "NccTransferReturnStatus" CASCADE;
DROP TYPE IF EXISTS "NccEmergencySuspensionStatus" CASCADE;
DROP TYPE IF EXISTS "NccRiskDecisionOutcome" CASCADE;
DROP TYPE IF EXISTS "NccOperationalAlertStatus" CASCADE;
DROP TYPE IF EXISTS "NccOperationalAlertSeverity" CASCADE;
DROP TYPE IF EXISTS "FinancialInstitutionType" CASCADE;
DROP TYPE IF EXISTS "FinancialInstitutionStatus" CASCADE;
DROP TYPE IF EXISTS "RoutingNumberStatus" CASCADE;
DROP TYPE IF EXISTS "InstitutionMemberRole" CASCADE;
DROP TYPE IF EXISTS "InstitutionMemberStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementAccountStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementInstructionStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementEntryType" CASCADE;
DROP TYPE IF EXISTS "SettlementExecutionStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementExecutionStep" CASCADE;
DROP TYPE IF EXISTS "TerminalCashAccountStatus" CASCADE;
DROP TYPE IF EXISTS "TerminalCashEntryType" CASCADE;
DROP TYPE IF EXISTS "TerminalTransferRequestStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementOutboxStatus" CASCADE;
DROP TYPE IF EXISTS "SettlementReconciliationStatus" CASCADE;
