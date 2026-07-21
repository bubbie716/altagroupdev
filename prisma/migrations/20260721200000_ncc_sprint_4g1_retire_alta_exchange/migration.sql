-- Sprint 4G.1: one-time idempotent retirement of Alta Exchange NCC participant.
-- No-op when the institution row is absent. Never deletes history or alters balances.

BEGIN;

UPDATE "FinancialInstitution"
SET
  status = 'TERMINATED',
  "isNCCParticipant" = false,
  "terminatedAt" = COALESCE("terminatedAt", CURRENT_TIMESTAMP),
  "suspendedAt" = COALESCE("suspendedAt", CURRENT_TIMESTAMP)
WHERE id = 'inst-alta-exchange';

UPDATE "RoutingNumber"
SET
  status = 'SUSPENDED',
  "deactivatedAt" = COALESCE("deactivatedAt", CURRENT_TIMESTAMP)
WHERE "institutionId" = 'inst-alta-exchange'
  AND status NOT IN ('SUSPENDED', 'RETIRED', 'INACTIVE');

UPDATE "SettlementAccount"
SET
  status = 'FROZEN',
  "frozenAt" = COALESCE("frozenAt", CURRENT_TIMESTAMP),
  "frozenReason" = COALESCE(
    "frozenReason",
    'Alta Exchange retired — Sprint 4G legal archival'
  )
WHERE "institutionId" = 'inst-alta-exchange'
  AND status <> 'FROZEN';

COMMIT;
