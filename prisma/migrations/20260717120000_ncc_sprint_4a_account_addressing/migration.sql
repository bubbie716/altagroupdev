-- Sprint 4A: Terminal cash account numbers + settlement addressing snapshots.

-- 1. TerminalCashAccount.accountNumber (nullable first for backfill)
ALTER TABLE "TerminalCashAccount" ADD COLUMN IF NOT EXISTS "accountNumber" TEXT;

-- 2. Backfill existing rows with unique 12-digit account numbers (not derived from id).
-- Uses md5(id || random()) for uniqueness while remaining deterministic per row in this migration.
UPDATE "TerminalCashAccount"
SET "accountNumber" = (
  SELECT lpad(
    (
      ('x' || substr(md5("id" || gen_random_uuid()::text), 1, 15))::bit(60)::bigint % 900000000000 + 100000000000
    )::text,
    12,
    '0'
  )
)
WHERE "accountNumber" IS NULL;

-- Collision repair loop: any remaining nulls or rare duplicates get fresh values
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  attempts INT;
BEGIN
  FOR r IN SELECT id FROM "TerminalCashAccount" WHERE "accountNumber" IS NULL
  LOOP
    attempts := 0;
    LOOP
      candidate := lpad((100000000000 + floor(random() * 900000000000))::bigint::text, 12, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "TerminalCashAccount" WHERE "accountNumber" = candidate);
      attempts := attempts + 1;
      EXIT WHEN attempts > 20;
    END LOOP;
    UPDATE "TerminalCashAccount" SET "accountNumber" = candidate WHERE id = r.id;
  END LOOP;

  -- Fix any duplicates created by the bulk update
  FOR r IN
    SELECT id FROM (
      SELECT id, "accountNumber",
             ROW_NUMBER() OVER (PARTITION BY "accountNumber" ORDER BY "createdAt", id) AS rn
      FROM "TerminalCashAccount"
      WHERE "accountNumber" IS NOT NULL
    ) d
    WHERE rn > 1
  LOOP
    attempts := 0;
    LOOP
      candidate := lpad((100000000000 + floor(random() * 900000000000))::bigint::text, 12, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "TerminalCashAccount" WHERE "accountNumber" = candidate);
      attempts := attempts + 1;
      EXIT WHEN attempts > 20;
    END LOOP;
    UPDATE "TerminalCashAccount" SET "accountNumber" = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "TerminalCashAccount" ALTER COLUMN "accountNumber" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TerminalCashAccount_accountNumber_key"
  ON "TerminalCashAccount"("accountNumber");

CREATE INDEX IF NOT EXISTS "TerminalCashAccount_accountNumber_idx"
  ON "TerminalCashAccount"("accountNumber");

-- 3. SettlementInstruction addressing snapshot columns
ALTER TABLE "SettlementInstruction"
  ADD COLUMN IF NOT EXISTS "sourceAccountNumberMasked" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationAccountNumberMasked" TEXT,
  ADD COLUMN IF NOT EXISTS "sendingRoutingNumberUsed" TEXT,
  ADD COLUMN IF NOT EXISTS "receivingRoutingNumberUsed" TEXT,
  ADD COLUMN IF NOT EXISTS "addressResolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceResolverKey" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationResolverKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceAccountNumberEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationAccountNumberEncrypted" TEXT;
