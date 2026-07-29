import type { TimelineEvent } from "@/lib/internal/ops-types";
import {
  ACCOUNT_ACTIVITY_FILTERS,
  CARD_ACTIVITY_FILTERS,
  CUSTOMER_ACTIVITY_FILTERS,
  LOAN_ACTIVITY_FILTERS,
  type RecordActivityFilter,
} from "@/lib/internal/record-workspace-search";

const MONEY_KINDS = new Set([
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER",
  "ADJUSTMENT",
  "PAYMENT",
  "ALTA_PAY",
  "FEE",
  "INTEREST",
  "STATEMENT_GENERATED",
  "ACCOUNT_CREATED",
]);

const PAYMENT_KINDS = new Set([
  "ALTA_PAY",
  "LOAN_PAYMENT",
  "ALTA_CARD_PAYMENT",
  "CARD_PAYMENT",
  "PAYMENT",
  "ALTA_CARD_PAYMENT_MADE",
  "ALTA_CARD_AUTOPAY_SUCCEEDED",
]);

const PURCHASE_KINDS = new Set([
  "ALTA_CARD_PURCHASE",
  "CARD_PURCHASE",
  "PURCHASE",
  "AUTHORIZATION",
]);

const ADJUSTMENT_KINDS = new Set([
  "ADJUSTMENT",
  "ALTA_CARD_ADJUSTMENT",
  "LOAN_ADJUSTMENT",
  "FEE",
  "FEE_CHARGE",
  "WAIVE",
]);

const INTEREST_KINDS = new Set([
  "INTEREST",
  "INTEREST_CREDIT",
  "INTEREST_CHARGE",
  "FEE",
  "FEE_CHARGE",
]);

const HOLD_KINDS = new Set([
  "HOLD",
  "HOLD_APPLIED",
  "HOLD_RELEASED",
  "RESTRICTION",
  "RESTRICTION_UPDATED",
]);

const STATUS_KINDS = new Set([
  "STATUS_CHANGE",
  "ALTA_CARD_FROZEN",
  "ALTA_CARD_UNFROZEN",
  "ALTA_CARD_ACTIVATED",
  "ALTA_CARD_DELINQUENT",
  "LOAN_FROZEN",
  "LOAN_UNFROZEN",
  "LOAN_PAID_OFF",
  "LOAN_CLOSED",
]);

const LENDING_KINDS = new Set([
  "LOAN_APPLICATION",
  "LOAN_APPROVED",
  "LOAN_FUNDED",
  "LOAN_PAYMENT",
  "LOAN_CLOSED",
  "LOAN_DENIED",
]);

const CARD_KINDS = new Set([
  "ALTA_CARD_APPLICATION",
  "ALTA_CARD_APPROVED",
  "ALTA_CARD_REVIEW",
  "ALTA_CARD_PAYMENT",
  "ALTA_CARD_PURCHASE",
]);

const RELATIONSHIP_KINDS = new Set([
  "RELATIONSHIP_SCORE_CHANGED",
  "RELATIONSHIP_TIER_CHANGED",
  "COMPANY_VERIFIED",
  "COMPANY_MEMBER_ADDED",
  "COMPANY_MEMBER_REMOVED",
  "TIER_CHANGE",
  "SCORE_CHANGE",
]);

const OPERATOR_KINDS = new Set([
  "OPS_REVIEW_FLAG",
  "OPS_REVIEW_FLAG_RESOLVED",
  "NOTE",
  "AUDIT",
  "ADMIN_ACTION",
  "STATUS_CHANGE",
  "TAG_GRANT",
  "TAG_REVOKE",
  "ACCOUNT_CREATED",
]);

type ActivityBucket =
  | "money"
  | "payments"
  | "purchases"
  | "adjustments"
  | "interest"
  | "holds"
  | "status"
  | "lending"
  | "cards"
  | "relationship"
  | "operator"
  | "all";

function classifyKind(kind: string): ActivityBucket {
  const k = kind.toUpperCase().replace(/\s+/g, "_");
  if (HOLD_KINDS.has(k) || k.includes("HOLD") || k.includes("RESTRICT")) return "holds";
  if (PURCHASE_KINDS.has(k) || k.includes("PURCHASE") || k.includes("AUTH")) return "purchases";
  if (STATUS_KINDS.has(k) || ((k.includes("FREEZE") || k.includes("UNFREEZE") || k.includes("CLOSE") || k.includes("ACTIVATE") || k.includes("DELINQUENT") || k.includes("PAID_OFF")) && !k.includes("NOTE"))) {
    return "status";
  }
  if (ADJUSTMENT_KINDS.has(k) || k.includes("ADJUST") || k.includes("WAIVE")) return "adjustments";
  if (INTEREST_KINDS.has(k) || k.includes("INTEREST") || (k.includes("FEE") && !k.includes("TRANSFER"))) {
    return "interest";
  }
  if (PAYMENT_KINDS.has(k) || (k.includes("PAY") && !k.includes("PAYOFF") && !k.includes("PURPOSE"))) {
    return "payments";
  }
  if (LENDING_KINDS.has(k) || k.includes("LOAN") || k.includes("LEND")) return "lending";
  if (CARD_KINDS.has(k) || k.includes("CARD")) return "cards";
  if (RELATIONSHIP_KINDS.has(k) || k.includes("RELATIONSHIP") || k.includes("TIER") || k.includes("SCORE")) {
    return "relationship";
  }
  if (
    OPERATOR_KINDS.has(k) ||
    k.includes("AUDIT") ||
    k.includes("OPS_") ||
    k.includes("ADMIN") ||
    k.includes("NOTE") ||
    k.includes("FLAG") ||
    k.includes("TAG")
  ) {
    return "operator";
  }
  if (
    MONEY_KINDS.has(k) ||
    k.includes("DEPOSIT") ||
    k.includes("WITHDRAW") ||
    k.includes("TRANSFER")
  ) {
    return "money";
  }
  if (k.includes("MEMBER") || k.includes("COMPANY") || k.includes("VERIFY")) return "relationship";
  return "all";
}

export type ActivityFilterScope = "default" | "account" | "card" | "loan";

export function eventMatchesActivityFilter(
  event: TimelineEvent,
  filter: RecordActivityFilter | undefined,
  scope: ActivityFilterScope = "default",
): boolean {
  if (!filter || filter === "all") return true;
  const bucket = classifyKind(event.kind);

  if (filter === "money") {
    if (scope === "account") return bucket === "money";
    return bucket === "money" || bucket === "payments" || bucket === "interest";
  }
  if (filter === "payments") return bucket === "payments";
  if (filter === "purchases") return bucket === "purchases" || (scope === "card" && bucket === "cards");
  if (filter === "adjustments") return bucket === "adjustments";
  if (filter === "interest") return bucket === "interest";
  if (filter === "holds") return bucket === "holds";
  if (filter === "status") return bucket === "status";
  if (bucket === filter) return true;

  if (filter === "operator") {
    if (bucket === "operator" || bucket === "status") return true;
    const hay = `${event.kind} ${event.title} ${event.detail} ${event.actorLabel ?? ""}`.toLowerCase();
    if (hay.includes("audit") || hay.includes("operator") || hay.includes("admin") || hay.includes("note") || hay.includes("ops")) {
      return true;
    }
  }
  return false;
}

export function filterTimelineEvents(
  events: TimelineEvent[],
  filter: RecordActivityFilter | undefined,
  scope: ActivityFilterScope = "default",
): TimelineEvent[] {
  return events.filter((e) => eventMatchesActivityFilter(e, filter, scope));
}

export const ACTIVITY_FILTER_LABELS: Record<RecordActivityFilter, string> = {
  all: "All",
  money: "Money",
  lending: "Lending",
  cards: "Cards",
  relationship: "Relationship",
  operator: "Operator actions",
  payments: "Payments",
  interest: "Interest & fees",
  holds: "Holds",
  purchases: "Purchases",
  adjustments: "Adjustments",
  status: "Status changes",
  cash: "Cash",
  orders: "Orders",
  dividends: "Dividends",
  fees: "Fees",
};

export const ACCOUNT_ACTIVITY_FILTER_LABELS: Record<(typeof ACCOUNT_ACTIVITY_FILTERS)[number], string> = {
  all: "All",
  money: "Money movement",
  payments: "Payments",
  interest: "Interest & fees",
  holds: "Holds",
  operator: "Operator actions",
};

export const CARD_ACTIVITY_FILTER_LABELS: Record<(typeof CARD_ACTIVITY_FILTERS)[number], string> = {
  all: "All",
  purchases: "Purchases",
  payments: "Payments",
  adjustments: "Adjustments",
  status: "Status changes",
  operator: "Operator actions",
};

export const LOAN_ACTIVITY_FILTER_LABELS: Record<(typeof LOAN_ACTIVITY_FILTERS)[number], string> = {
  all: "All",
  payments: "Payments",
  interest: "Interest & fees",
  adjustments: "Adjustments",
  status: "Status changes",
  operator: "Operator actions",
};

/** Human-readable category chip for an event. */
export function activityCategoryLabel(kind: string): string {
  const bucket = classifyKind(kind);
  if (bucket === "all") return "Activity";
  return ACTIVITY_FILTER_LABELS[bucket] ?? "Activity";
}

export {
  CUSTOMER_ACTIVITY_FILTERS,
  ACCOUNT_ACTIVITY_FILTERS,
  CARD_ACTIVITY_FILTERS,
  LOAN_ACTIVITY_FILTERS,
};
