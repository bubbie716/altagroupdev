-- Sprint 3B.1: crash-safe claim leases for webhook deliveries and outbox processing

ALTER TABLE "SettlementOutboxEvent" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "SettlementOutboxEvent" ADD COLUMN IF NOT EXISTS "claimToken" TEXT;

CREATE INDEX IF NOT EXISTS "SettlementOutboxEvent_status_claimedAt_idx"
  ON "SettlementOutboxEvent"("status", "claimedAt");

ALTER TABLE "NccWebhookDelivery" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "NccWebhookDelivery" ADD COLUMN IF NOT EXISTS "claimToken" TEXT;

CREATE INDEX IF NOT EXISTS "NccWebhookDelivery_status_claimedAt_idx"
  ON "NccWebhookDelivery"("status", "claimedAt");
