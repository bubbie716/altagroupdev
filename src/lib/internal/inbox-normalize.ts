import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";
import { queueAgeMs } from "@/components/internal/queues/queue-utils";
import type { InternalBankAccountRow, InternalBankTransactionRow } from "@/lib/bank/backend-types";
import type { InternalLoanApplicationRow } from "@/lib/bank/lending-types";
import type { AltaCardApplicationRow } from "@/lib/bank/alta-card-types";
import {
  isOpenAltaCardReviewStatus,
  type AltaCardReviewQueueRow,
} from "@/lib/bank/alta-card-review-types";
import type { InternalCompanyRow } from "@/lib/company/types";
import type { ExceptionItem } from "@/lib/internal/ops-types";
import {
  INBOX_CASE_TYPE_LABELS,
  type InboxCategory,
  type InboxItem,
  type InboxSearch,
  type InboxStatusTone,
  type InboxSummary,
} from "@/lib/internal/inbox-types";

const OPEN_LENDING = new Set(["pending", "under_review"]);
const OPEN_CARD_APP = new Set(["submitted", "under_review", "needs_info"]);

function statusTone(raw: string): InboxStatusTone {
  const s = raw.toLowerCase().replace(/\s+/g, "_");
  if (s.includes("escalat")) return "escalated";
  if (s.includes("needs_info") || s.includes("waiting")) return "waiting_on_customer";
  if (s.includes("under_review") || s.includes("submitted") || s.includes("pending")) {
    return "needs_review";
  }
  return "open";
}

function humanStatus(raw: string): string {
  const s = raw.trim();
  if (!s) return "Needs review";
  const lower = s.toLowerCase();
  if (lower === "pending" || lower === "open") return "Needs review";
  if (lower === "under_review" || lower === "under review") return "Needs review";
  if (lower === "submitted") return "Needs review";
  if (lower === "needs_info" || lower === "needs info") return "Waiting on customer";
  if (lower === "escalated") return "Escalated";
  if (lower === "resolved" || lower === "dismissed") return humanize(lower);
  return humanize(s);
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseAmount(formatted: string | null | undefined): number | null {
  if (formatted == null || formatted === "") return null;
  const n = Number(String(formatted).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function inboxItemFromDeposit(row: InternalBankTransactionRow): InboxItem {
  return {
    id: `deposit:${row.id}`,
    category: "money",
    caseType: "deposit",
    title: "Review deposit",
    description: row.description || row.holder,
    partyLabel: row.holder,
    amount: parseAmount(row.amount),
    amountLabel: row.amount,
    status: row.status,
    statusLabel: humanStatus(row.status),
    statusTone: statusTone(row.status),
    priority: "normal",
    createdAt: row.submitted,
    ageMs: queueAgeMs(row.submitted),
    referenceLabel: row.referenceCode,
    destination: {
      to: "/internal/bank/transactions/$transactionId",
      params: { transactionId: row.id },
    },
    actions: ["approve", "deny", "open"],
    hasProof: Boolean(row.hasProof),
    assignee: null,
    actionTargetId: row.id,
  };
}

export function inboxItemFromWithdrawal(row: InternalBankTransactionRow): InboxItem {
  return {
    id: `withdrawal:${row.id}`,
    category: "money",
    caseType: "withdrawal",
    title: "Review withdrawal",
    description: row.description || row.holder,
    partyLabel: row.holder,
    amount: parseAmount(row.amount),
    amountLabel: row.amount,
    status: row.status,
    statusLabel: humanStatus(row.status),
    statusTone: statusTone(row.status),
    priority: "normal",
    createdAt: row.submitted,
    ageMs: queueAgeMs(row.submitted),
    referenceLabel: row.referenceCode,
    destination: {
      to: "/internal/bank/transactions/$transactionId",
      params: { transactionId: row.id },
    },
    actions: ["approve", "deny", "open"],
    hasProof: Boolean(row.hasProof),
    assignee: null,
    actionTargetId: row.id,
  };
}

export function inboxItemFromAccountOpening(row: InternalBankAccountRow): InboxItem {
  return {
    id: `account_opening:${row.id}`,
    category: "account_opening",
    caseType: "account_opening",
    title: row.accountNumber,
    description: `${row.product} · ${row.accountName}`,
    partyLabel: row.holder,
    amount: parseAmount(row.balance),
    amountLabel: row.balance,
    status: row.status,
    statusLabel: humanStatus(row.status),
    statusTone: statusTone(row.status),
    priority: "normal",
    createdAt: row.createdAt,
    ageMs: queueAgeMs(row.createdAt),
    referenceLabel: row.companyName,
    destination: {
      to: "/internal/bank/accounts/$accountId",
      params: { accountId: row.id },
    },
    actions: ["approve", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

export function inboxItemFromCompany(row: InternalCompanyRow): InboxItem | null {
  const state = normalizeCompanyVerificationStatus(row.verificationStatus);
  if (state !== "unverified" && state !== "pending") return null;
  return {
    id: `company_verification:${row.id}`,
    category: "companies",
    caseType: "company_verification",
    title: row.name,
    description: `${row.type} · ${row.sector}`,
    partyLabel: row.primaryContact || row.name,
    amount: null,
    amountLabel: null,
    status: row.verificationStatus,
    statusLabel: humanStatus(row.verificationStatus),
    statusTone: statusTone(row.verificationStatus),
    priority: "normal",
    createdAt: row.lastUpdated,
    ageMs: queueAgeMs(row.lastUpdated),
    referenceLabel: row.ticker,
    destination: {
      to: "/internal/companies/$companyId",
      params: { companyId: row.id },
      search: { tab: "more", section: "verification" },
    },
    actions: ["approve", "deny", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

function compactPartyLabel(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const segment of part.split("·").map((s) => s.trim()).filter(Boolean)) {
      const key = segment.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(segment);
    }
  }
  return out.join(" · ");
}

export function inboxItemFromLendingApp(row: InternalLoanApplicationRow): InboxItem | null {
  if (!OPEN_LENDING.has(row.status)) return null;
  const partyLabel = compactPartyLabel(row.companyName, row.applicantLabel);
  const waitingEvidence = row.threadStatus === "waiting_on_applicant";
  return {
    id: `lending_application:${row.id}`,
    category: "lending",
    caseType: "lending_application",
    title: row.productLabel || "Lending application",
    description: partyLabel,
    partyLabel,
    amount: row.requestedAmount,
    amountLabel: null,
    status: waitingEvidence ? "waiting_on_applicant" : row.status,
    statusLabel: waitingEvidence ? "Waiting on evidence" : humanStatus(row.status),
    statusTone: waitingEvidence ? "waiting_on_customer" : statusTone(row.status),
    priority: "normal",
    createdAt: row.submittedAt,
    ageMs: queueAgeMs(row.submittedAt),
    referenceLabel: row.linkedAccountNumber,
    destination: {
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: row.id },
      search: waitingEvidence ? { section: "evidence" } : {},
    },
    actions: ["review", "deny", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

export function inboxItemFromCardApp(row: AltaCardApplicationRow): InboxItem | null {
  if (!OPEN_CARD_APP.has(row.status)) return null;
  return {
    id: `alta_card_application:${row.id}`,
    category: "cards",
    caseType: "alta_card_application",
    title: `Card application · ${row.cardType}`,
    description: row.applicantUsername + (row.companyName ? ` · ${row.companyName}` : ""),
    partyLabel: row.applicantUsername,
    amount: row.requestedLimit ?? null,
    amountLabel: null,
    status: row.status,
    statusLabel: humanStatus(row.status),
    statusTone: statusTone(row.status),
    priority: "normal",
    createdAt: row.createdAt,
    ageMs: queueAgeMs(row.createdAt),
    referenceLabel: null,
    destination: {
      to: "/internal/alta-card/applications/$applicationId",
      params: { applicationId: row.id },
      search: {},
    },
    actions: ["review", "deny", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

export function inboxItemFromCardReview(row: AltaCardReviewQueueRow): InboxItem | null {
  if (!isOpenAltaCardReviewStatus(row.status)) return null;
  return {
    id: `alta_card_review:${row.id}`,
    category: "cards",
    caseType: "alta_card_review",
    title: row.requestedChangesSummary || "Card review",
    description: row.applicantUsername + (row.companyName ? ` · ${row.companyName}` : ""),
    partyLabel: row.applicantUsername,
    amount: row.requestedLimit ?? null,
    amountLabel: null,
    status: row.status,
    statusLabel: humanStatus(row.status),
    statusTone: statusTone(row.status),
    priority: "normal",
    createdAt: row.createdAt,
    ageMs: queueAgeMs(row.createdAt),
    referenceLabel: row.altaCardId,
    destination: {
      to: "/internal/alta-card/reviews/$reviewId",
      params: { reviewId: row.id },
      search: {},
    },
    actions: ["review", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

/** Aggregate queue summaries that duplicate individual money cases when both are present. */
export const AGGREGATE_QUEUE_EXCEPTION_IDS = new Set(["queue-deposits", "queue-withdrawals"]);

export function isAggregateQueueException(item: InboxItem): boolean {
  if (item.caseType !== "exception") return false;
  const rawId = item.actionTargetId || item.id.replace(/^exception:/, "");
  return AGGREGATE_QUEUE_EXCEPTION_IDS.has(rawId);
}

/**
 * Individual actionable records are authoritative.
 * Drop aggregate "N pending deposits/withdrawals" exceptions when matching money cases exist.
 * Standalone exceptions (negative balance, failed transfer, large adjustment, etc.) are kept.
 */
export function dedupeInboxItems(items: InboxItem[]): InboxItem[] {
  const hasDeposit = items.some((i) => i.caseType === "deposit");
  const hasWithdrawal = items.some((i) => i.caseType === "withdrawal");
  return items.filter((item) => {
    if (!isAggregateQueueException(item)) return true;
    const rawId = item.actionTargetId || item.id.replace(/^exception:/, "");
    if (rawId === "queue-deposits") return !hasDeposit;
    if (rawId === "queue-withdrawals") return !hasWithdrawal;
    return true;
  });
}

export function inboxItemFromException(row: ExceptionItem): InboxItem | null {
  if (row.dispositionStatus === "RESOLVED" || row.dispositionStatus === "DISMISSED") {
    return null;
  }
  const priority =
    row.severity === "critical" ? "critical" : row.severity === "high" ? "high" : "medium";

  const transferMatch = row.href.match(/^\/internal\/bank\/transfers\/([^/?#]+)/);
  let destination: InboxItem["destination"];
  if (transferMatch) {
    destination = {
      to: "/internal/bank/transfers/$transferId",
      params: { transferId: transferMatch[1]! },
      search: {},
    };
  } else if (row.id === "queue-deposits") {
    destination = {
      to: "/internal/inbox",
      search: { category: "money", type: "deposit" },
    };
  } else if (row.id === "queue-withdrawals") {
    destination = {
      to: "/internal/inbox",
      search: { category: "money", type: "withdrawal" },
    };
  } else {
    destination = {
      to: row.href.startsWith("/internal/") ? row.href : "/internal/inbox",
    };
  }

  const title =
    row.id === "queue-deposits"
      ? "Pending deposits"
      : row.id === "queue-withdrawals"
        ? "Pending withdrawals"
        : row.title;

  return {
    id: `exception:${row.id}`,
    category: "risk",
    caseType: "exception",
    title,
    description: row.detail,
    partyLabel:
      row.category === "failed_transfer"
        ? "Failed transfer"
        : row.category === "pending_review"
          ? "Queue summary"
          : row.category.replace(/_/g, " "),
    amount: row.amount ?? null,
    amountLabel: null,
    status: row.dispositionStatus ?? "OPEN",
    statusLabel: humanStatus(row.dispositionStatus ?? "open"),
    statusTone: row.dispositionStatus === "ESCALATED" ? "escalated" : "needs_review",
    priority,
    createdAt: row.createdAt,
    ageMs: queueAgeMs(row.createdAt),
    referenceLabel: transferMatch?.[1] ?? null,
    destination,
    actions: ["resolve", "escalate", "dismiss", "open"],
    hasProof: false,
    assignee: null,
    actionTargetId: row.id,
  };
}

/** Deal rooms that need attention — mapped into lending/cards categories. */
export function inboxItemFromDealRoomLending(row: InternalLoanApplicationRow): InboxItem | null {
  const base = inboxItemFromLendingApp(row);
  if (!base) return null;
  return {
    ...base,
    id: `deal_room:lending:${row.id}`,
    caseType: "deal_room",
    title: `Deal room · ${base.title}`,
    destination: {
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: row.id },
      search: { section: "evidence" },
    },
    actions: ["review", "open"],
  };
}

export function inboxItemFromDealRoomCardApp(row: AltaCardApplicationRow): InboxItem | null {
  const base = inboxItemFromCardApp(row);
  if (!base) return null;
  return {
    ...base,
    id: `deal_room:card_app:${row.id}`,
    caseType: "deal_room",
    title: `Deal room · ${base.title}`,
    destination: {
      to: "/internal/alta-card/applications/$applicationId",
      params: { applicationId: row.id },
      search: { section: "evidence" },
    },
    actions: ["review", "open"],
  };
}

export function inboxItemFromDealRoomCardReview(row: AltaCardReviewQueueRow): InboxItem | null {
  const base = inboxItemFromCardReview(row);
  if (!base) return null;
  return {
    ...base,
    id: `deal_room:card_review:${row.id}`,
    caseType: "deal_room",
    title: `Deal room · ${base.title}`,
    destination: {
      to: "/internal/alta-card/reviews/$reviewId",
      params: { reviewId: row.id },
      search: { section: "evidence" },
    },
    actions: ["review", "open"],
  };
}

export function buildInboxSummary(items: InboxItem[]): InboxSummary {
  const byCategory: InboxSummary["byCategory"] = {
    all: items.length,
    money: 0,
    account_opening: 0,
    companies: 0,
    lending: 0,
    cards: 0,
    risk: 0,
  };
  let oldestAgeMs: number | null = null;
  let olderThan24Hours = 0;
  let olderThan72Hours = 0;
  for (const item of items) {
    byCategory[item.category] += 1;
    if (oldestAgeMs == null || item.ageMs > oldestAgeMs) oldestAgeMs = item.ageMs;
    if (item.ageMs >= 24 * 3_600_000) olderThan24Hours += 1;
    if (item.ageMs >= 72 * 3_600_000) olderThan72Hours += 1;
  }
  return { total: items.length, oldestAgeMs, olderThan24Hours, olderThan72Hours, byCategory };
}

export function filterAndSortInboxItems(items: InboxItem[], search: InboxSearch): InboxItem[] {
  let rows = items;
  if (search.category && search.category !== "all") {
    rows = rows.filter((i) => i.category === search.category);
  }
  if (search.type && search.type !== "all") {
    rows = rows.filter((i) => i.caseType === search.type);
  }
  if (search.status) {
    const needle = search.status.toLowerCase();
    rows = rows.filter(
      (i) =>
        i.status.toLowerCase().includes(needle) ||
        i.statusLabel.toLowerCase().includes(needle) ||
        i.statusTone.replace(/_/g, " ").includes(needle),
    );
  }
  if (search.q) {
    const q = search.q.toLowerCase();
    rows = rows.filter((i) => {
      const hay = [
        i.title,
        i.description,
        i.partyLabel,
        i.referenceLabel ?? "",
        i.statusLabel,
        INBOX_CASE_TYPE_LABELS[i.caseType],
        i.amountLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  const newestFirst = search.sort === "newest";
  rows = [...rows].sort((a, b) =>
    newestFirst ? a.ageMs - b.ageMs || b.createdAt.localeCompare(a.createdAt) : b.ageMs - a.ageMs || a.createdAt.localeCompare(b.createdAt),
  );
  return rows;
}

export function formatInboxAge(ageMs: number): string {
  const hours = ageMs / 3_600_000;
  if (hours < 1) return "< 1 hour";
  if (hours < 24) {
    const h = Math.floor(hours);
    return `${h}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function categoryLabel(category: InboxCategory | "all"): string {
  const map: Record<string, string> = {
    all: "All",
    money: "Money",
    account_opening: "Openings",
    companies: "Companies",
    lending: "Lending",
    cards: "Cards",
    risk: "Risk",
  };
  return map[category] ?? category;
}

/** Primary CTA / accessible action verb for an Inbox case. */
export function inboxPrimaryActionLabel(item: InboxItem): string {
  switch (item.caseType) {
    case "deposit":
      return "Review deposit";
    case "withdrawal":
      return "Review withdrawal";
    case "account_opening":
      return "Review account opening";
    case "company_verification":
      return "Review company verification";
    case "lending_application":
      return "Review application";
    case "alta_card_application":
      return "Review application";
    case "alta_card_review":
      return "Review card";
    case "deal_room":
      return "Review evidence";
    case "exception":
      if (item.partyLabel === "Failed transfer") return "Review failed transfer";
      if (/negative/i.test(item.title) || /negative/i.test(item.partyLabel)) return "Review account";
      return "Review exception";
    default:
      return "Open case";
  }
}
