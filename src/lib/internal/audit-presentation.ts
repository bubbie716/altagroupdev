/** Display helpers for Audit Log — humanization, categories, grouping, pagination. */

import type { AuditLogRow } from "@/lib/internal/audit.types";
import { formatOpsAuditActionTitle, isPassiveHomeActivityAction } from "@/lib/internal/ops-activity-title";

export const AUDIT_PAGE_SIZE = 50;

export type AuditEventCategoryId =
  | "money"
  | "lending"
  | "cards"
  | "accounts"
  | "access"
  | "jobs"
  | "alerts"
  | "other";

export const AUDIT_EVENT_CATEGORIES: Array<{ id: AuditEventCategoryId; label: string }> = [
  { id: "money", label: "Money" },
  { id: "lending", label: "Lending" },
  { id: "cards", label: "Cards" },
  { id: "accounts", label: "Accounts" },
  { id: "access", label: "Access" },
  { id: "jobs", label: "Jobs" },
  { id: "alerts", label: "Staff alerts" },
  { id: "other", label: "Other" },
];

const LOW_VALUE_GROUP_ACTIONS = new Set([
  "STAFF_AUDIT_MESSAGE_FAILED",
  "ALTA_CARD_RELATIONSHIP_RECOMMENDATION_VIEWED",
  "RELATIONSHIP_RECOMMENDATION_VIEWED",
  "COMPANY_RELATIONSHIP_RECOMMENDATION_VIEWED",
]);

export function auditEventCategory(action: string): AuditEventCategoryId {
  const key = action.trim().toUpperCase().replace(/\s+/g, "_");
  if (/DEPOSIT|WITHDRAWAL|TRANSFER|INTEREST|ADJUSTMENT|FEE|PAYROLL|ALTA_PAY|PAYMENT/.test(key)) {
    return "money";
  }
  if (/^LOAN_|LENDING_|DEAL_ROOM/.test(key)) return "lending";
  if (/ALTA_CARD/.test(key)) return "cards";
  if (/ACCOUNT_|BANK_ACCOUNT|HOLD_|STATEMENT/.test(key)) return "accounts";
  if (/RESTRICT|FREEZE|FROZEN|UNFREEZE|MAINTENANCE|CREDIT_DESK|TAG_|ROLE_/.test(key)) {
    return "access";
  }
  if (/OPS_JOB|JOB_RUN|SERVICING|RECONCILIATION/.test(key)) return "jobs";
  if (/STAFF_AUDIT|STAFF_ALERT|NOTIFICATION/.test(key)) return "alerts";
  return "other";
}

export function actionMatchesAuditCategory(action: string, category: AuditEventCategoryId): boolean {
  return auditEventCategory(action) === category;
}

/** Meaningful default view excludes passive recommendation / intelligence views. */
export function isLowValueAuditAction(action: string): boolean {
  if (isPassiveHomeActivityAction(action)) return true;
  const key = action.trim().toUpperCase().replace(/\s+/g, "_");
  return LOW_VALUE_GROUP_ACTIONS.has(key);
}

export function isGroupableAuditAction(action: string): boolean {
  const key = action.trim().toUpperCase().replace(/\s+/g, "_");
  return LOW_VALUE_GROUP_ACTIONS.has(key) || isPassiveHomeActivityAction(action);
}

export type AuditDisplayRow =
  | { kind: "single"; row: AuditLogRow }
  | {
      kind: "group";
      action: string;
      title: string;
      count: number;
      first: AuditLogRow;
      last: AuditLogRow;
      rows: AuditLogRow[];
    };

/** Collapse consecutive identical low-value events into grouped rows. */
export function groupConsecutiveAuditRows(rows: AuditLogRow[]): AuditDisplayRow[] {
  const out: AuditDisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (!isGroupableAuditAction(row.action)) {
      out.push({ kind: "single", row });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < rows.length && rows[j]!.action === row.action) j += 1;
    const slice = rows.slice(i, j);
    if (slice.length === 1) {
      out.push({ kind: "single", row });
    } else {
      out.push({
        kind: "group",
        action: row.action,
        title: formatOpsAuditActionTitle(row.action),
        count: slice.length,
        first: slice[0]!,
        last: slice[slice.length - 1]!,
        rows: slice,
      });
    }
    i = j;
  }
  return out;
}

export function auditTargetLabel(row: AuditLogRow): string {
  if (row.targetUsername) return row.targetUsername;
  if (row.targetAccountName || row.targetAccountNumber) {
    return [row.targetAccountName, row.targetAccountNumber].filter(Boolean).join(" · ");
  }
  if (row.targetCompanyId) return `Company ${row.targetCompanyId.slice(0, 8)}`;
  if (row.targetLoanId) return `Loan ${row.targetLoanId.slice(0, 8)}`;
  if (row.entityId) return `${row.entityType} ${row.entityId.slice(0, 8)}`;
  return "—";
}

export function auditHasActiveFilters(filters: {
  q?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  actor?: string;
  targetUserId?: string;
  targetAccountId?: string;
  targetCompanyId?: string;
  from?: string;
  to?: string;
  category?: string;
}): boolean {
  return Boolean(
    filters.q ||
      filters.action ||
      filters.entityType ||
      filters.entityId ||
      filters.actorUserId ||
      filters.actor ||
      filters.targetUserId ||
      filters.targetAccountId ||
      filters.targetCompanyId ||
      filters.from ||
      filters.to ||
      filters.category,
  );
}
