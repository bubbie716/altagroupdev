import type { AuditEntityType } from "@prisma/client";

export type AuditLogRow = {
  id: string;
  actorUserId: string;
  actorUsername: string;
  targetUserId: string | null;
  targetUsername: string | null;
  targetAccountId: string | null;
  targetAccountNumber: string | null;
  targetAccountName: string | null;
  targetCompanyId: string | null;
  targetTransactionId: string | null;
  targetLoanId: string | null;
  /** NCC institution scope for portal audit isolation. */
  institutionId: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogFilters = {
  q?: string;
  action?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  actorUserId?: string;
  targetUserId?: string;
  targetAccountId?: string;
  targetCompanyId?: string;
  institutionId?: string;
  from?: string;
  to?: string;
};

export type WriteAuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: AuditEntityType;
  description: string;
  entityId?: string;
  targetUserId?: string;
  targetAccountId?: string;
  targetCompanyId?: string;
  targetTransactionId?: string;
  targetLoanId?: string;
  /** NCC institution scope for portal audit isolation. */
  institutionId?: string;
  metadata?: Record<string, unknown>;
};
