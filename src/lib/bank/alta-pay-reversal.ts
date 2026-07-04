/** Alta Pay reversal linkage — works without a dedicated AltaPayPayment table. */

export const ALTA_PAY_REVERSAL_MEMO_PREFIX = "reversesAltaPay:";

export function altaPayReversalMarker(originalBaseReference: string): string {
  return `${ALTA_PAY_REVERSAL_MEMO_PREFIX}${originalBaseReference}`;
}

/** Future AltaPayPayment entity idempotency key. */
export function altaPayPaymentReversalKey(originalBaseReference: string): string {
  return `alta-pay-reversal:${originalBaseReference}`;
}

export function parseAltaPayReversalMarker(memo: string | null | undefined): string | null {
  if (!memo) return null;
  const idx = memo.indexOf(ALTA_PAY_REVERSAL_MEMO_PREFIX);
  if (idx === -1) return null;
  const ref = memo.slice(idx + ALTA_PAY_REVERSAL_MEMO_PREFIX.length).trim();
  return ref.length > 0 ? ref : null;
}

export function normalizeAltaPayReference(referenceCode: string): string {
  return referenceCode.replace(/-OUT$|-IN$|-CARD$/, "");
}

export function isAltaPayReversalReference(referenceCode: string): boolean {
  return referenceCode.startsWith("PAY-REV-");
}
