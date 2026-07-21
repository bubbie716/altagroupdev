import type { CorporateAction, ResearchDocument, ResearchSection } from "./types";

/** GET /v1/filings */
export function getFilings(_section?: ResearchSection): ResearchDocument[] {
  return [];
}

/** GET /v1/corporate-actions */
export function getCorporateActions(): CorporateAction[] {
  return [];
}
