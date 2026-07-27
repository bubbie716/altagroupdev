/** Build apply-modal search while preserving localhost ?site=. */
export function withApplySearch(
  prev: Record<string, unknown>,
  extra?: Record<string, string>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { apply: "1", ...(extra ?? {}) };
  if (typeof prev.site === "string" && prev.site) next.site = prev.site;
  return next;
}
