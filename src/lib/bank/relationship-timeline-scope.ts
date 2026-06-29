/** Personal timelines should not include company-scoped product events. */
export function isBusinessTimelineScope(companyId: string | null | undefined): boolean {
  return companyId != null;
}
