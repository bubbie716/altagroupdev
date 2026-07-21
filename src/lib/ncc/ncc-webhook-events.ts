/** Shared webhook subscription event types (mirrors settlement outbox). */
export const NCC_WEBHOOK_EVENT_TYPES = [
  "settlement.submitted",
  "settlement.ncc_posted",
  "settlement.completed",
  "settlement.failed",
  "settlement.cancelled",
  "settlement.retry_pending",
  "settlement.manual_review",
  "settlement.reversed",
  "settlement.compensated",
] as const;

export type NccWebhookEventType = (typeof NCC_WEBHOOK_EVENT_TYPES)[number];
