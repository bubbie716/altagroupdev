export function internalDocumentTitleSuffix(site?: string | null): string {
  if (site === "bank") return "Alta Bank Internal";
  if (site === "terminal" || site === "exchange") return "Alta Terminal Internal";
  return "Alta Internal";
}

export function internalDocumentTitle(pageTitle: string, site?: string | null): string {
  const page = pageTitle.trim();
  return `${page} — ${internalDocumentTitleSuffix(site)}`;
}
