/**
 * Canonical search state for customer/company/account record workspaces.
 * Legacy tab IDs normalize into Overview / Activity / More + optional section/filter.
 */

import { normalizeInternalSearch, serializeInternalSearch } from "@/lib/internal/normalize-internal-search";

export const RECORD_PRIMARY_TABS = ["overview", "activity", "more"] as const;
export type RecordPrimaryTab = (typeof RECORD_PRIMARY_TABS)[number];

/** Filters used on customer/company Activity. */
export const CUSTOMER_ACTIVITY_FILTERS = [
  "all",
  "money",
  "lending",
  "cards",
  "relationship",
  "operator",
] as const;

/** Filters used on Bank account Activity. */
export const ACCOUNT_ACTIVITY_FILTERS = [
  "all",
  "money",
  "payments",
  "interest",
  "holds",
  "operator",
] as const;

/** Filters used on Alta Card Activity. */
export const CARD_ACTIVITY_FILTERS = [
  "all",
  "purchases",
  "payments",
  "adjustments",
  "status",
  "operator",
] as const;

/** Filters used on active loan Activity. */
export const LOAN_ACTIVITY_FILTERS = [
  "all",
  "payments",
  "interest",
  "adjustments",
  "status",
  "operator",
] as const;

/** All known activity filter IDs (union for URL validation). */
export const RECORD_ACTIVITY_FILTERS = [
  "all",
  "money",
  "lending",
  "cards",
  "relationship",
  "operator",
  "payments",
  "interest",
  "holds",
  "purchases",
  "adjustments",
  "status",
  "cash",
  "orders",
  "dividends",
  "fees",
] as const;

export type RecordActivityFilter = (typeof RECORD_ACTIVITY_FILTERS)[number];

export type RecordWorkspaceSearch = {
  tab: RecordPrimaryTab;
  section?: string;
  filter?: RecordActivityFilter;
  /** Safe relative return path (e.g. Inbox with filters preserved). */
  from?: string;
  /** Localhost UI Lab / multi-site param — must survive validateSearch. */
  site?: string;
  /** UI Lab only — crypto ops desk/workspace demonstration scenario. */
  cryptoOpsScenario?: string;
};

/** Compact transaction record — no primary tabs; section anchors only. */
export type TransactionRecordSearch = {
  section?: string;
  from?: string;
  /** Localhost UI Lab / multi-site param — must survive validateSearch. */
  site?: string;
};

export type RecordLegacyMapping = {
  tab: RecordPrimaryTab;
  section?: string;
  filter?: RecordActivityFilter;
};

/** Customer legacy tab → canonical workspace state. */
export const CUSTOMER_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  accounts: { tab: "overview", section: "accounts" },
  "alta-card": { tab: "overview", section: "cards" },
  lending: { tab: "overview", section: "lending" },
  relationship: { tab: "overview", section: "relationship" },
  companies: { tab: "overview", section: "companies" },
  terminal: { tab: "overview", section: "terminal" },
  timeline: { tab: "activity" },
  activity: { tab: "activity" },
  audit: { tab: "activity", filter: "operator" },
  "review-flags": { tab: "more", section: "review-flags" },
  flags: { tab: "more", section: "review-flags" },
  notes: { tab: "more", section: "notes" },
};

/** Company legacy tab → canonical workspace state. */
export const COMPANY_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  members: { tab: "overview", section: "people" },
  accounts: { tab: "overview", section: "accounts" },
  "alta-card": { tab: "overview", section: "cards" },
  lending: { tab: "overview", section: "lending" },
  relationship: { tab: "overview", section: "relationship" },
  "alta-pay": { tab: "overview", section: "commercial" },
  terminal: { tab: "overview", section: "terminal" },
  timeline: { tab: "activity" },
  activity: { tab: "activity" },
  audit: { tab: "activity", filter: "operator" },
  "review-flags": { tab: "more", section: "review-flags" },
  flags: { tab: "more", section: "review-flags" },
  notes: { tab: "more", section: "notes" },
};

/** Bank account legacy tab → canonical workspace state. */
export const ACCOUNT_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  transactions: { tab: "activity", filter: "money" },
  activity: { tab: "activity" },
  statements: { tab: "more", section: "statements" },
  holds: { tab: "more", section: "holds" },
  "holds-restrictions": { tab: "more", section: "holds" },
  audit: { tab: "more", section: "audit" },
  notes: { tab: "more", section: "notes" },
};

/** Transaction legacy tab → section on the single-page record. */
export const TRANSACTION_LEGACY_TAB_MAP: Record<string, string> = {
  overview: "summary",
  related: "related",
  "related-records": "related",
  "review-flags": "review-flags",
  flags: "review-flags",
  audit: "audit",
  notes: "notes",
};

/** Alta Card product legacy tab → canonical workspace state. */
export const CARD_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  transactions: { tab: "activity", filter: "purchases" },
  history: { tab: "activity" },
  activity: { tab: "activity" },
  payments: { tab: "activity", filter: "payments" },
  statements: { tab: "more", section: "statements" },
  autopay: { tab: "more", section: "autopay" },
  employees: { tab: "more", section: "employees" },
  controls: { tab: "more", section: "controls" },
  relationship: { tab: "overview", section: "related" },
  audit: { tab: "more", section: "audit" },
  notes: { tab: "more", section: "notes" },
};

/** Active loan legacy tab → canonical workspace state. */
export const LOAN_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  payments: { tab: "overview", section: "payments" },
  schedule: { tab: "more", section: "schedule" },
  "deal-room": { tab: "more", section: "evidence" },
  thread: { tab: "more", section: "evidence" },
  relationship: { tab: "overview", section: "related" },
  activity: { tab: "activity" },
  audit: { tab: "more", section: "audit" },
  notes: { tab: "more", section: "notes" },
};

/**
 * Case-record legacy tabs (lending application, card application/review).
 * Single-page records map tabs → section anchors.
 */
export const CASE_RECORD_LEGACY_TAB_MAP: Record<string, string> = {
  overview: "summary",
  decision: "decision",
  thread: "evidence",
  "deal-room": "evidence",
  evidence: "evidence",
  underwriting: "evidence",
  related: "related",
  "related-records": "related",
  audit: "audit",
  notes: "notes",
  flags: "review-flags",
  "review-flags": "review-flags",
};

/** Scheduled / transfer instruction legacy tab → section. */
export const TRANSFER_LEGACY_TAB_MAP: Record<string, string> = {
  overview: "summary",
  summary: "summary",
  lifecycle: "lifecycle",
  history: "lifecycle",
  executions: "lifecycle",
  related: "related",
  "related-records": "related",
  audit: "audit",
  notes: "notes",
  technical: "technical",
};

/** Alta Pay payment / invoice / payment-link legacy tab → section. */
export const ALTA_PAY_LEGACY_TAB_MAP: Record<string, string> = {
  overview: "summary",
  summary: "summary",
  lifecycle: "lifecycle",
  related: "related",
  "related-records": "related",
  reminders: "reminders",
  payments: "related",
  audit: "audit",
  notes: "notes",
  technical: "technical",
};

/** Terminal crypto asset workspace — Overview / Activity / More. */
export const CRYPTO_ASSET_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  summary: { tab: "overview", section: "summary" },
  reserves: { tab: "overview", section: "reserves" },
  integrity: { tab: "overview", section: "integrity" },
  activity: { tab: "activity" },
  timeline: { tab: "activity" },
  status: { tab: "activity", filter: "status" },
  orders: { tab: "activity", filter: "orders" },
  fees: { tab: "more", section: "fees" },
  settlements: { tab: "more", section: "settlements" },
  ledger: { tab: "more", section: "ledger" },
  candles: { tab: "more", section: "candles" },
  technical: { tab: "more", section: "technical" },
  more: { tab: "more" },
};

/** Terminal portfolio legacy tab → canonical workspace state. */
export const PORTFOLIO_LEGACY_TAB_MAP: Record<string, RecordLegacyMapping> = {
  overview: { tab: "overview" },
  holdings: { tab: "overview", section: "holdings" },
  orders: { tab: "overview", section: "orders" },
  related: { tab: "overview", section: "related" },
  activity: { tab: "activity" },
  timeline: { tab: "activity" },
  cash: { tab: "activity", filter: "cash" },
  ownership: { tab: "more", section: "ownership" },
  status: { tab: "more", section: "status" },
  technical: { tab: "more", section: "technical" },
  audit: { tab: "more", section: "audit" },
  notes: { tab: "more", section: "notes" },
};

/** Terminal order legacy tab → section on the single-page record. */
export const ORDER_LEGACY_TAB_MAP: Record<string, string> = {
  overview: "summary",
  summary: "summary",
  lifecycle: "lifecycle",
  fill: "fill",
  fills: "fill",
  related: "related",
  "related-records": "related",
  audit: "audit",
  notes: "notes",
  technical: "technical",
};

/** Alias for transaction-style case search. */
export type CaseRecordSearch = TransactionRecordSearch;

const SAFE_FROM_RE = /^\/internal(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*)?(?:\?[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?(?:#[A-Za-z0-9._~!$&'()*+,;=:@%/?-]*)?$/;

export function isSafeInternalFrom(from: string | undefined | null): from is string {
  if (!from || typeof from !== "string") return false;
  if (from.includes("//") || from.includes("\\")) return false;
  return SAFE_FROM_RE.test(from);
}

export function parseRecordActivityFilter(
  value: string | undefined | null,
): RecordActivityFilter | undefined {
  if (!value) return undefined;
  return (RECORD_ACTIVITY_FILTERS as readonly string[]).includes(value)
    ? (value as RecordActivityFilter)
    : undefined;
}

export function normalizeRecordWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
  legacyMap: Record<string, RecordLegacyMapping>,
): RecordWorkspaceSearch {
  const s = search && typeof search === "object" ? search : {};
  const rawTab = typeof s.tab === "string" ? s.tab : undefined;
  const rawSection = typeof s.section === "string" && s.section.length > 0 ? s.section : undefined;
  const rawFilter = parseRecordActivityFilter(typeof s.filter === "string" ? s.filter : undefined);
  const rawFrom = typeof s.from === "string" ? s.from : undefined;

  const mapped = rawTab ? legacyMap[rawTab] : undefined;
  const isPrimary = rawTab && (RECORD_PRIMARY_TABS as readonly string[]).includes(rawTab);

  let tab: RecordPrimaryTab = "overview";
  let section = rawSection;
  let filter = rawFilter;

  if (isPrimary) {
    tab = rawTab as RecordPrimaryTab;
  } else if (mapped) {
    tab = mapped.tab;
    section = section ?? mapped.section;
    filter = filter ?? mapped.filter;
  } else if (mapped === undefined && rawTab) {
    tab = "overview";
  }

  if (!section && mapped?.section && isPrimary === false) {
    section = mapped.section;
  }

  const result: RecordWorkspaceSearch = { tab };
  if (section) result.section = section;
  if (filter && filter !== "all") result.filter = filter;
  if (isSafeInternalFrom(rawFrom)) result.from = rawFrom;
  if (typeof s.site === "string" && s.site.trim()) result.site = s.site.trim();
  if (typeof s.cryptoOpsScenario === "string" && s.cryptoOpsScenario.trim()) {
    result.cryptoOpsScenario = s.cryptoOpsScenario.trim();
  }
  return result;
}

export function parseCustomerWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, CUSTOMER_LEGACY_TAB_MAP);
}

export function parseCompanyWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, COMPANY_LEGACY_TAB_MAP);
}

export function parseAccountWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, ACCOUNT_LEGACY_TAB_MAP);
}

export function parseTransactionRecordSearch(
  search: Record<string, unknown> | undefined | null,
): TransactionRecordSearch {
  return parseCaseRecordSearch(search, TRANSACTION_LEGACY_TAB_MAP);
}

export function parseCardWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, CARD_LEGACY_TAB_MAP);
}

export function parseLoanWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, LOAN_LEGACY_TAB_MAP);
}

export function parseCaseRecordSearch(
  search: Record<string, unknown> | undefined | null,
  legacyMap: Record<string, string> = CASE_RECORD_LEGACY_TAB_MAP,
): CaseRecordSearch {
  const s = search && typeof search === "object" ? search : {};
  const rawTab = typeof s.tab === "string" ? s.tab : undefined;
  const rawSection = typeof s.section === "string" && s.section.length > 0 ? s.section : undefined;
  const rawFrom = typeof s.from === "string" ? s.from : undefined;

  let section = rawSection;
  if (!section && rawTab && legacyMap[rawTab]) {
    section = legacyMap[rawTab];
  }
  if (section === "summary" || section === "overview") section = undefined;

  const result: CaseRecordSearch = {};
  if (section) result.section = section;
  if (isSafeInternalFrom(rawFrom)) result.from = rawFrom;
  if (typeof s.site === "string" && s.site.trim()) result.site = s.site.trim();
  return result;
}

export function parseLendingApplicationSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, CASE_RECORD_LEGACY_TAB_MAP);
}

export function parseCardApplicationSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, CASE_RECORD_LEGACY_TAB_MAP);
}

export function parseCardReviewSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, CASE_RECORD_LEGACY_TAB_MAP);
}

export function parseTransferRecordSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, TRANSFER_LEGACY_TAB_MAP);
}

export function parseAltaPayRecordSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, ALTA_PAY_LEGACY_TAB_MAP);
}

export function parseInvoiceRecordSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, ALTA_PAY_LEGACY_TAB_MAP);
}

export function parsePaymentLinkRecordSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, ALTA_PAY_LEGACY_TAB_MAP);
}

export function parseTerminalPortfolioWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, PORTFOLIO_LEGACY_TAB_MAP);
}

export function parseTerminalCryptoWorkspaceSearch(
  search: Record<string, unknown> | undefined | null,
): RecordWorkspaceSearch {
  return normalizeRecordWorkspaceSearch(search, CRYPTO_ASSET_LEGACY_TAB_MAP);
}

export function parseTerminalOrderRecordSearch(
  search: Record<string, unknown> | undefined | null,
): CaseRecordSearch {
  return parseCaseRecordSearch(search, ORDER_LEGACY_TAB_MAP);
}

export function toTransferRecordSearchParams(state: {
  section?: string | null;
  from?: string | null;
}): Record<string, string> {
  return toCaseRecordSearchParams(state);
}

export function toAltaPayRecordSearchParams(state: {
  section?: string | null;
  from?: string | null;
}): Record<string, string> {
  return toCaseRecordSearchParams(state);
}

/** Build search object for navigation — omit undefined / default keys; stable key order. */
export function toRecordWorkspaceSearchParams(state: {
  tab?: RecordPrimaryTab | string;
  section?: string | null;
  filter?: RecordActivityFilter | string | null;
  from?: string | null;
  site?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {
    tab: state.tab && (RECORD_PRIMARY_TABS as readonly string[]).includes(state.tab)
      ? state.tab
      : "overview",
  };
  if (state.section) out.section = state.section;
  if (state.filter && state.filter !== "all") out.filter = state.filter;
  if (isSafeInternalFrom(state.from ?? undefined)) out.from = state.from!;
  if (state.site) out.site = state.site;
  return normalizeInternalSearch(out) as Record<string, string>;
}

export function toTransactionRecordSearchParams(state: {
  section?: string | null;
  from?: string | null;
}): Record<string, string> {
  return toCaseRecordSearchParams(state);
}

export function toCaseRecordSearchParams(state: {
  section?: string | null;
  from?: string | null;
  site?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.section && state.section !== "summary" && state.section !== "overview") {
    out.section = state.section;
  }
  if (isSafeInternalFrom(state.from ?? undefined)) out.from = state.from!;
  if (state.site) out.site = state.site;
  return normalizeInternalSearch(out) as Record<string, string>;
}

/** Canonical href helpers for relationship deep links (replaces legacy ?tab=relationship). */
export function customerRelationshipSearch(from?: string) {
  return toRecordWorkspaceSearchParams({
    tab: "overview",
    section: "relationship",
    from,
  });
}

export function companyRelationshipSearch(from?: string) {
  return toRecordWorkspaceSearchParams({
    tab: "overview",
    section: "relationship",
    from,
  });
}

export function recordSectionId(section: string): string {
  return `record-section-${section}`;
}

/** Build a safe `from` path preserving list filters. */
export function buildListReturnPath(
  pathname: string,
  params: Record<string, string | undefined | null>,
): string {
  if (!pathname.startsWith("/internal")) return "/internal";
  const q = serializeInternalSearch(params as Record<string, unknown>);
  return q ? `${pathname}?${q}` : pathname;
}
