/** Shared helpers for customer/company directory desks (Phase 5). */

import type { AccountStatus } from "@/lib/auth/types";
import type { InternalUserListRow } from "@/lib/internal/user-management.types";
import type { InternalCompanyRow } from "@/lib/company/types";
import { formatAccountStatus } from "@/lib/auth/tags";

export function customerNeedsDirectoryAttention(user: InternalUserListRow): boolean {
  return (
    user.accountStatus === "restricted" ||
    user.accountStatus === "frozen" ||
    user.accountStatus === "pending_review"
  );
}

export function companyNeedsDirectoryAttention(company: InternalCompanyRow): boolean {
  const v = company.verificationStatus.toLowerCase();
  return v === "pending" || v === "unverified" || v === "rejected";
}

export function sortCustomersForDirectory(
  users: InternalUserListRow[],
  attentionOnly: boolean,
): InternalUserListRow[] {
  const rows = attentionOnly ? users.filter(customerNeedsDirectoryAttention) : [...users];
  return rows.sort((a, b) => {
    const aAtt = customerNeedsDirectoryAttention(a) ? 0 : 1;
    const bAtt = customerNeedsDirectoryAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    return b.lastLoginAt.localeCompare(a.lastLoginAt);
  });
}

export function sortCompaniesForDirectory(
  companies: InternalCompanyRow[],
  attentionOnly: boolean,
): InternalCompanyRow[] {
  const rows = attentionOnly ? companies.filter(companyNeedsDirectoryAttention) : [...companies];
  return rows.sort((a, b) => {
    const aAtt = companyNeedsDirectoryAttention(a) ? 0 : 1;
    const bAtt = companyNeedsDirectoryAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });
}

export function customerProductSummary(
  user: InternalUserListRow,
  opts?: { includeTerminal?: boolean },
): string {
  const parts: string[] = [];
  if (user.bankAccountCount > 0) {
    parts.push(`${user.bankAccountCount} acct${user.bankAccountCount === 1 ? "" : "s"}`);
  }
  if (user.altaCardCount > 0) parts.push("Card");
  if (user.activeLoanCount > 0) {
    parts.push(`${user.activeLoanCount} loan${user.activeLoanCount === 1 ? "" : "s"}`);
  }
  if (user.companyCount > 0) {
    parts.push(`${user.companyCount} co${user.companyCount === 1 ? "" : "s"}`);
  }
  if (opts?.includeTerminal !== false && user.terminalPortfolioCount > 0) {
    parts.push("Terminal");
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function customerStandingLabel(status: AccountStatus): string {
  return formatAccountStatus(status);
}

export function customerSecondaryId(user: InternalUserListRow): string | null {
  if (user.minecraftUsername) return `MC ${user.minecraftUsername}`;
  if (user.email) {
    const at = user.email.indexOf("@");
    return at > 0 ? user.email.slice(0, Math.min(at + 1, 18)) + (at < user.email.length - 1 ? "…" : "") : user.email;
  }
  return null;
}

export function companyTypeSectorLabel(company: InternalCompanyRow): string {
  const type = company.type?.trim() || "Company";
  const sector = company.sector?.trim();
  return sector ? `${type} · ${sector}` : type;
}

export function companyMatchesQuery(company: InternalCompanyRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [company.name, company.ticker ?? "", company.type, company.sector ?? "", company.primaryContact, company.id]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/** Cap related-record lists; return visible slice + whether View all is needed. */
export function limitRelatedRecords<T>(items: T[], limit = 4): { visible: T[]; hasMore: boolean; remaining: number } {
  if (items.length <= limit) return { visible: items, hasMore: false, remaining: 0 };
  return { visible: items.slice(0, limit), hasMore: true, remaining: items.length - limit };
}

export function suggestedLoanPaymentAmount(paymentSchedule: Array<{
  status: string;
  remainingAmount: number;
}>): number | null {
  const due = paymentSchedule
    .filter((i) => i.status === "overdue" || i.status === "partial" || i.status === "pending")
    .sort((a, b) => {
      const rank = (s: string) => (s === "overdue" ? 0 : s === "partial" ? 1 : 2);
      return rank(a.status) - rank(b.status);
    })[0];
  if (!due || !(due.remainingAmount > 0)) return null;
  return due.remainingAmount;
}
