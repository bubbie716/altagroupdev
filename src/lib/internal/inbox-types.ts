/** Unified Inbox — operator-facing work items normalized from queue sources. */

import { normalizeInternalSearch } from "@/lib/internal/normalize-internal-search";

export type InboxCategory =
  | "money"
  | "account_opening"
  | "companies"
  | "lending"
  | "cards"
  | "risk";

export type InboxCaseType =
  | "deposit"
  | "withdrawal"
  | "account_opening"
  | "company_verification"
  | "lending_application"
  | "alta_card_application"
  | "alta_card_review"
  | "deal_room"
  | "exception";

export type InboxStatusTone = "needs_review" | "waiting_on_customer" | "ready_for_decision" | "escalated" | "open";

export type InboxActionKind = "approve" | "deny" | "resolve" | "escalate" | "dismiss" | "review" | "open";

export type InboxItem = {
  id: string;
  category: InboxCategory;
  caseType: InboxCaseType;
  title: string;
  description: string;
  partyLabel: string;
  amount: number | null;
  amountLabel: string | null;
  status: string;
  statusLabel: string;
  statusTone: InboxStatusTone;
  priority: "critical" | "high" | "medium" | "normal";
  createdAt: string;
  ageMs: number;
  referenceLabel: string | null;
  destination: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  };
  actions: InboxActionKind[];
  hasProof: boolean;
  assignee: string | null;
  /** Opaque payload for action handlers (transaction id, application id, etc.). */
  actionTargetId: string;
};

export type InboxSummary = {
  total: number;
  oldestAgeMs: number | null;
  olderThan24Hours: number;
  olderThan72Hours: number;
  byCategory: Record<InboxCategory | "all", number>;
};

export type InboxSearch = {
  category?: InboxCategory | "all";
  type?: InboxCaseType | "all";
  status?: string;
  q?: string;
  sort?: "oldest" | "newest";
  caseId?: string;
  /** Localhost UI Lab / multi-site param — must survive validateSearch. */
  site?: string;
};

export const INBOX_CATEGORY_LABELS: Record<InboxCategory | "all", string> = {
  all: "All",
  money: "Money",
  account_opening: "Openings",
  companies: "Companies",
  lending: "Lending",
  cards: "Cards",
  risk: "Risk",
};

export const INBOX_CASE_TYPE_LABELS: Record<InboxCaseType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  account_opening: "Account opening",
  company_verification: "Company verification",
  lending_application: "Lending application",
  alta_card_application: "Card application",
  alta_card_review: "Card review",
  deal_room: "Deal room",
  exception: "Exception",
};

export const LEGACY_QUEUE_TO_INBOX: Record<
  string,
  { category?: InboxCategory; type?: InboxCaseType }
> = {
  deposits: { category: "money", type: "deposit" },
  withdrawals: { category: "money", type: "withdrawal" },
  "account-openings": { category: "account_opening", type: "account_opening" },
  "company-verifications": { category: "companies", type: "company_verification" },
  "lending-applications": { category: "lending", type: "lending_application" },
  "alta-card-applications": { category: "cards", type: "alta_card_application" },
  "alta-card-reviews": { category: "cards", type: "alta_card_review" },
  "deal-rooms": { type: "deal_room" },
  exceptions: { category: "risk", type: "exception" },
};

export function parseInboxSearch(search: Record<string, unknown> | undefined | null): InboxSearch {
  const s = search && typeof search === "object" ? search : {};
  const category =
    typeof s.category === "string" && s.category in INBOX_CATEGORY_LABELS
      ? (s.category as InboxCategory | "all")
      : "all";
  const type =
    typeof s.type === "string" && s.type in INBOX_CASE_TYPE_LABELS
      ? (s.type as InboxCaseType)
      : typeof s.type === "string" && s.type === "all"
        ? "all"
        : undefined;
  return {
    category,
    type,
    status: typeof s.status === "string" && s.status.length > 0 ? s.status : undefined,
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    sort: s.sort === "newest" ? "newest" : "oldest",
    caseId: typeof s.caseId === "string" && s.caseId.length > 0 ? s.caseId : undefined,
    site: typeof s.site === "string" && s.site.trim() ? s.site.trim() : undefined,
  };
}

export function inboxSearchToParams(search: InboxSearch): Record<string, string | undefined> {
  return normalizeInternalSearch({
    category: search.category && search.category !== "all" ? search.category : undefined,
    type: search.type && search.type !== "all" ? search.type : undefined,
    status: search.status,
    q: search.q,
    sort: search.sort && search.sort !== "oldest" ? search.sort : undefined,
    caseId: search.caseId,
    site: search.site,
  }) as Record<string, string | undefined>;
}

export type InboxPayload = {
  items: InboxItem[];
  filtered: InboxItem[];
  summary: InboxSummary;
  search: InboxSearch;
};
