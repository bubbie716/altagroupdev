export const ADJUSTMENT_REVERSAL_NOTE_PREFIX = "reversesAdjustment:";

export function adjustmentReversalNote(originalReferenceCode: string): string {
  return `${ADJUSTMENT_REVERSAL_NOTE_PREFIX}${originalReferenceCode}`;
}

export function parseAdjustmentReversalNote(reviewNote: string | null | undefined): string | null {
  if (!reviewNote) return null;
  const idx = reviewNote.indexOf(ADJUSTMENT_REVERSAL_NOTE_PREFIX);
  if (idx === -1) return null;
  const ref = reviewNote.slice(idx + ADJUSTMENT_REVERSAL_NOTE_PREFIX.length).trim();
  return ref.length > 0 ? ref : null;
}

export function isAdjustmentReversalNote(reviewNote: string | null | undefined): boolean {
  return parseAdjustmentReversalNote(reviewNote) !== null;
}
