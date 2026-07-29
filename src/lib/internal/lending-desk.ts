/** Attention ranking and directory helpers for Lending product desk. */

import type {
  InternalActiveLoanRow,
  InternalLoanApplicationRow,
  LoanStatusCode,
} from "@/lib/bank/lending-types";
import { florin } from "@/lib/bank/api";

export type LendingAttentionItem = {
  id: string;
  label: string;
  count: number;
  to: string;
  search: Record<string, unknown>;
  cta: string;
  tone: "alert" | "warn" | "info" | "neutral";
};

export function isOpenLendingApplication(app: InternalLoanApplicationRow): boolean {
  return app.status === "pending" || app.status === "under_review";
}

export function isWaitingOnEvidence(app: InternalLoanApplicationRow): boolean {
  return isOpenLendingApplication(app) && app.threadStatus === "waiting_on_applicant";
}

/** Overdue evidence: waiting on applicant for more than 72 hours. */
export function isOverdueEvidence(app: InternalLoanApplicationRow, now = Date.now()): boolean {
  if (!isWaitingOnEvidence(app)) return false;
  const age = now - Date.parse(app.submittedAt);
  return Number.isFinite(age) && age >= 72 * 3_600_000;
}

export function loanHasPaymentAttention(loan: InternalActiveLoanRow): boolean {
  return loan.paymentSchedule.some((i) => i.status === "overdue" || i.status === "failed");
}

export function loanIsTerminalStatus(loan: Pick<InternalActiveLoanRow, "status">): boolean {
  return loan.status === "paid_off" || loan.status === "defaulted" || loan.status === "cancelled";
}

/**
 * Authoritative UI predicate for operator loan payment forms.
 * Matches server policy: only ACTIVE loans accept payments (`PAYABLE_LOAN_STATUSES`).
 * Also hide when payoff is already zero.
 */
export function canAcceptLoanPayment(
  loan: Pick<InternalActiveLoanRow, "status" | "currentPayoffAmount">,
): boolean {
  if (loan.status !== "active") return false;
  if (!(loan.currentPayoffAmount > 0)) return false;
  return true;
}

/** Concise status copy when the payment form is hidden. */
export function loanPaymentUnavailableCopy(
  loan: Pick<InternalActiveLoanRow, "status" | "currentPayoffAmount" | "statusLabel">,
): string | null {
  if (canAcceptLoanPayment(loan)) return null;
  if (loan.status === "paid_off") return "This loan is paid off.";
  if (loan.status === "cancelled") return "This loan is cancelled.";
  if (loan.status === "defaulted") return "This loan is in default.";
  if (loan.status === "frozen") return "This loan is frozen — payments are not accepted.";
  if (!(loan.currentPayoffAmount > 0)) return "No amount is due on this loan.";
  return `Payments are not accepted for this loan (${loan.statusLabel}).`;
}

export function loanNeedsDirectoryAttention(loan: InternalActiveLoanRow): boolean {
  // Paid-off loans are resolved — never treat schedule leftovers as active attention.
  if (loan.status === "paid_off") return false;
  if (loan.status === "frozen" || loan.status === "defaulted") return true;
  return loanHasPaymentAttention(loan);
}

export function loanBorrowerType(loan: InternalActiveLoanRow): "personal" | "company" {
  return loan.companyName ? "company" : "personal";
}

export function formatLoanBorrowerTypeLabel(type: "personal" | "company"): string {
  return type === "company" ? "Company" : "Personal";
}

/**
 * Loan status precedes schedule-derived labels. Paid-off / frozen / defaulted
 * must not surface stale overdue CTAs from historical schedule rows.
 */
export function nextLoanDueLabel(loan: InternalActiveLoanRow): string {
  if (loan.status === "paid_off") return "Paid off";
  if (loan.status === "frozen") return "Frozen";
  if (loan.status === "defaulted") return "Defaulted";

  const overdue = loan.paymentSchedule.find((i) => i.status === "overdue");
  if (overdue) return `Overdue · ${overdue.dueDate.slice(0, 10)}`;
  const failed = loan.paymentSchedule.find((i) => i.status === "failed");
  if (failed) return `Failed payment · ${failed.dueDate.slice(0, 10)}`;
  const pending = loan.paymentSchedule
    .filter((i) => i.status === "pending" || i.status === "partial")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (pending) return `Due ${pending.dueDate.slice(0, 10)}`;
  if (loan.nextInterestAccrualAt) return `Interest ${loan.nextInterestAccrualAt.slice(0, 10)}`;
  return "—";
}

export function buildLendingAttentionItems(input: {
  applications: InternalLoanApplicationRow[];
  frozenLoans: InternalActiveLoanRow[];
  defaultedLoans?: InternalActiveLoanRow[];
  siteKey: string;
  withSite: (base: Record<string, unknown>, site?: string) => Record<string, unknown>;
}): LendingAttentionItem[] {
  const { applications, frozenLoans, defaultedLoans = [], siteKey, withSite } = input;
  const open = applications.filter(isOpenLendingApplication);
  const waitingEvidence = open.filter(isWaitingOnEvidence);
  const awaitingReview = open.filter((a) => !isWaitingOnEvidence(a));
  const overdueEvidence = waitingEvidence.filter((a) => isOverdueEvidence(a));
  const delinquent = [
    ...frozenLoans.filter(loanHasPaymentAttention),
    ...defaultedLoans,
  ];
  // Frozen without payment issues still need attention as frozen.
  const frozenOnly = frozenLoans.filter((l) => !loanHasPaymentAttention(l));

  const items: LendingAttentionItem[] = [];

  if (awaitingReview.length > 0) {
    items.push({
      id: "apps-review",
      label: "Applications awaiting review",
      count: awaitingReview.length,
      to: "/internal/inbox",
      search: withSite(
        { category: "lending", type: "lending_application", status: "under_review" },
        siteKey,
      ),
      cta: "Review application",
      tone: "alert",
    });
  }
  if (waitingEvidence.length > 0) {
    items.push({
      id: "apps-evidence",
      label: "Applications waiting on evidence",
      count: waitingEvidence.length,
      to: "/internal/inbox",
      search: withSite(
        { category: "lending", type: "lending_application", status: "waiting_on_customer" },
        siteKey,
      ),
      cta: "Review evidence",
      tone: "warn",
    });
  }
  if (overdueEvidence.length > 0 && overdueEvidence.length !== waitingEvidence.length) {
    items.push({
      id: "apps-evidence-overdue",
      label: "Applications with overdue evidence",
      count: overdueEvidence.length,
      to: "/internal/inbox",
      search: withSite(
        { category: "lending", type: "lending_application", status: "waiting_on_customer", sort: "oldest" },
        siteKey,
      ),
      cta: "Review evidence",
      tone: "alert",
    });
  }
  if (frozenOnly.length > 0) {
    items.push({
      id: "loans-frozen",
      label: "Frozen loans",
      count: frozenOnly.length,
      to: "/internal/lending/loans",
      search: withSite({ status: "frozen", attention: "1" }, siteKey),
      cta: "Review loan",
      tone: "warn",
    });
  }
  if (delinquent.length > 0) {
    items.push({
      id: "loans-delinquent",
      label: "Delinquent or defaulted loans",
      count: delinquent.length,
      to: "/internal/lending/loans",
      search: withSite({ attention: "1" }, siteKey),
      cta: "Review loan",
      tone: "alert",
    });
  }

  return items;
}

export function sortLoansForDirectory(loans: InternalActiveLoanRow[]): InternalActiveLoanRow[] {
  const statusRank = (s: LoanStatusCode): number => {
    if (s === "defaulted") return 0;
    if (s === "frozen") return 1;
    if (s === "active") return 3;
    if (s === "paid_off") return 4;
    return 2;
  };
  return [...loans].sort((a, b) => {
    const aAtt = loanNeedsDirectoryAttention(a) ? 0 : 1;
    const bAtt = loanNeedsDirectoryAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    const sr = statusRank(a.status) - statusRank(b.status);
    if (sr !== 0) return sr;
    const aDue = nextLoanDueSortKey(a);
    const bDue = nextLoanDueSortKey(b);
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.borrowerLabel.localeCompare(b.borrowerLabel);
  });
}

function nextLoanDueSortKey(loan: InternalActiveLoanRow): string {
  const overdue = loan.paymentSchedule.find((i) => i.status === "overdue");
  if (overdue) return `0-${overdue.dueDate}`;
  const pending = loan.paymentSchedule
    .filter((i) => i.status === "pending" || i.status === "partial")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (pending) return `1-${pending.dueDate}`;
  if (loan.lastPaymentAt) return `2-${loan.lastPaymentAt}`;
  return `3-${loan.id}`;
}

export function formatLoanOutstanding(loan: InternalActiveLoanRow): string {
  return florin(loan.outstandingBalance);
}

export function loanDirectoryMatchesQuery(loan: InternalActiveLoanRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    loan.id,
    loan.borrowerLabel,
    loan.companyName ?? "",
    loan.productLabel,
    loan.linkedAccountNumber ?? "",
    loan.linkedBankAccountId ?? "",
    loan.status,
    loan.statusLabel,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
