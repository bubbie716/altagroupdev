/** Stable idempotency key for one intended transfer attempt (retries reuse the same key). */
export function resolveFundingIdempotencyKey(existing: string | null): string {
  return existing ?? crypto.randomUUID();
}
