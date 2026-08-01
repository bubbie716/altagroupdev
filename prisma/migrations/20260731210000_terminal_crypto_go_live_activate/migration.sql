-- Terminal crypto production go-live: activate launch assets NPFC / NVA / VLT.
-- Idempotent: only transitions rows still in DRAFT; status-change rows use unique idempotency keys.
-- Foundation migrations remain DRAFT-only; this migration is the activation source of truth.

WITH activated AS (
  UPDATE "TerminalCryptoAsset"
  SET
    "status" = 'ACTIVE',
    "version" = "version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "symbol" IN ('NPFC', 'NVA', 'VLT')
    AND "status" = 'DRAFT'
  RETURNING "id", "symbol", "version"
)
INSERT INTO "TerminalCryptoAssetStatusChange" (
  "id",
  "assetId",
  "fromStatus",
  "toStatus",
  "reason",
  "actorUserId",
  "idempotencyKey",
  "expectedVersion",
  "createdAt"
)
SELECT
  CASE a."symbol"
    WHEN 'NPFC' THEN 'tcas_npfc_go_live'
    WHEN 'NVA' THEN 'tcas_nva_go_live'
    WHEN 'VLT' THEN 'tcas_vlt_go_live'
  END,
  a."id",
  'DRAFT',
  'ACTIVE',
  'Production go-live activation',
  'system-crypto-go-live',
  CASE a."symbol"
    WHEN 'NPFC' THEN 'go_live_activate_npfc'
    WHEN 'NVA' THEN 'go_live_activate_nva'
    WHEN 'VLT' THEN 'go_live_activate_vlt'
  END,
  a."version" - 1,
  CURRENT_TIMESTAMP
FROM activated a
ON CONFLICT ("assetId", "idempotencyKey") DO NOTHING;
