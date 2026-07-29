/** Default TanStack Router search objects for internal workspace routes. */

import {
  parseCardWorkspaceSearch,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import { preserveDevSiteSearch } from "@/lib/site/preserve-dev-site-search";

/** Merge localhost `?site=` into internal Link/search payloads (canonical key order). */
export function withInternalSiteSearch<T extends Record<string, unknown>>(
  base: T,
  site?: string | null,
): T & { site?: string } {
  return preserveDevSiteSearch(null, base, site);
}

export {
  normalizeInternalSearch,
  serializeInternalSearch,
  INTERNAL_SEARCH_KEY_PRIORITY,
} from "@/lib/internal/normalize-internal-search";

export const INTERNAL_USER_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_COMPANY_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_ACCOUNT_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_TRANSACTION_WORKSPACE_SEARCH = {} as const;

export const INTERNAL_TRANSFER_RECORD_SEARCH = {} as const;

export const INTERNAL_ALTA_PAY_RECORD_SEARCH = {} as const;

export const INTERNAL_INVOICE_RECORD_SEARCH = {} as const;

export const INTERNAL_PAYMENT_LINK_RECORD_SEARCH = {} as const;

export const INTERNAL_ALTA_CARD_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

/** Case records (applications/reviews) are tabless — empty default search. */
export const INTERNAL_ALTA_CARD_APPLICATION_SEARCH = {} as const;

export const INTERNAL_ALTA_CARD_REVIEW_SEARCH = {} as const;

export const INTERNAL_LENDING_APPLICATION_SEARCH = {} as const;

export const INTERNAL_LOAN_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH = {
  tab: "overview" as const,
};

export const INTERNAL_TERMINAL_ORDER_RECORD_SEARCH = {} as const;

export function internalWorkspaceTabSearch(tab: string) {
  return { tab };
}

export {
  parseCustomerWorkspaceSearch,
  parseCompanyWorkspaceSearch,
  parseAccountWorkspaceSearch,
  parseTransactionRecordSearch,
  parseCardWorkspaceSearch,
  parseLoanWorkspaceSearch,
  parseLendingApplicationSearch,
  parseCardApplicationSearch,
  parseCardReviewSearch,
  parseCaseRecordSearch,
  parseTransferRecordSearch,
  parseAltaPayRecordSearch,
  parseInvoiceRecordSearch,
  parsePaymentLinkRecordSearch,
  parseTerminalPortfolioWorkspaceSearch,
  parseTerminalOrderRecordSearch,
  customerRelationshipSearch,
  companyRelationshipSearch,
  toRecordWorkspaceSearchParams,
  toTransactionRecordSearchParams,
  toCaseRecordSearchParams,
  toTransferRecordSearchParams,
  toAltaPayRecordSearchParams,
  buildListReturnPath,
} from "@/lib/internal/record-workspace-search";

export type AltaCardWorkspaceSearch = RecordWorkspaceSearch & {
  suggestedTier?: string;
  suggestedLimit?: number;
  suggestedRate?: number;
  recommendationId?: string;
};

/**
 * Compose Phase-5 canonical card workspace search with RI prefill params.
 * Never reads optional keys from undefined search.
 */
export function parseAltaCardWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): AltaCardWorkspaceSearch {
  const base = parseCardWorkspaceSearch(search);
  const s = search && typeof search === "object" ? search : {};
  const result: AltaCardWorkspaceSearch = { ...base };

  if (typeof s.suggestedTier === "string" && s.suggestedTier.length > 0) {
    result.suggestedTier = s.suggestedTier;
  }
  if (s.suggestedLimit != null && s.suggestedLimit !== "") {
    const n = Number(s.suggestedLimit);
    if (Number.isFinite(n)) result.suggestedLimit = n;
  }
  if (s.suggestedRate != null && s.suggestedRate !== "") {
    const n = Number(s.suggestedRate);
    if (Number.isFinite(n)) result.suggestedRate = n;
  }
  if (typeof s.recommendationId === "string" && s.recommendationId.length > 0) {
    result.recommendationId = s.recommendationId;
  }

  return result;
}
