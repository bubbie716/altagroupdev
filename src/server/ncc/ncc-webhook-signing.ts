import { hmacSha256Hex, timingSafeEqualString } from "@/server/crypto";

/** Sign exact raw body: HMAC-SHA256(secret, timestamp + "." + rawBody) → hex. */
export async function signWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
): Promise<string> {
  return hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
}

export async function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const tolerance = input.toleranceSeconds ?? 300;
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > tolerance) return false;
  const expected = await signWebhookPayload(input.secret, input.timestamp, input.rawBody);
  return timingSafeEqualString(expected, input.signature);
}

export function buildWebhookHeaders(input: {
  eventId: string;
  eventType: string;
  deliveryId: string;
  timestamp: string;
  signature: string;
}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "NCC-Webhooks/1.0",
    "NCC-Event-Id": input.eventId,
    "NCC-Event-Type": input.eventType,
    "NCC-Delivery-Id": input.deliveryId,
    "NCC-Timestamp": input.timestamp,
    "NCC-Signature": input.signature,
  };
}

/** Documented test vector helpers for docs/tests. */
export const WEBHOOK_SIGNATURE_TEST_VECTOR = {
  secret: "whsec_test_vector_do_not_use_in_production",
  timestamp: "1720000000",
  rawBody: '{"hello":"ncc"}',
  // Computed in tests — placeholder documented in NCC_WEBHOOKS.md
} as const;
