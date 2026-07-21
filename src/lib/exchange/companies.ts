import type { CompanyProfile, ListedCompany } from "./types";

/** GET /v1/companies */
export function getCompanies(): ListedCompany[] {
  return [];
}

/** GET /v1/companies/:ticker */
export function getCompany(_ticker: string): CompanyProfile | null {
  return null;
}
