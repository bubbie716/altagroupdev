/**
 * Operator review / resolve / reopen for crypto reconciliation issues (Phase 5).
 * Does not repair balances. Auto-resolve from fingerprint clearance remains in the recon engine.
 *
 * Permissions:
 * - Terminal admin or Corporate: resolve open issues with a reason (operator acknowledgment)
 * - Corporate only: reopen a resolved issue (separation of duties vs market halt operators)
 */

import type { AltaUser } from "@/lib/auth/types";
import { isCorporateAdmin, isTerminalAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import {
  CryptoOpsError,
  requireConfirmation,
  requireIdempotencyKey,
  requireNonemptyReason,
} from "./crypto-ops-errors";

export type ResolveCryptoReconIssueInput = {
  issueId: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
};

export type ReopenCryptoReconIssueInput = {
  issueId: string;
  reason: string;
  confirmed: boolean;
  idempotencyKey: string;
};

export type CryptoReconIssueActionResult = {
  issueId: string;
  status: "OPEN" | "RESOLVED";
  fingerprint: string;
  symbol: string | null;
  replayed: boolean;
};

function assertTerminalOpsActor(actor: AltaUser): void {
  if (!isTerminalAdmin(actor) && !isCorporateAdmin(actor)) {
    throw new CryptoOpsError("FORBIDDEN");
  }
}

export async function resolveCryptoReconciliationIssue(
  actor: AltaUser,
  input: ResolveCryptoReconIssueInput,
): Promise<CryptoReconIssueActionResult> {
  assertTerminalOpsActor(actor);
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  requireIdempotencyKey(input.idempotencyKey);

  const issue = await prisma.terminalCryptoReconciliationIssue.findUnique({
    where: { id: input.issueId },
    include: { asset: { select: { symbol: true } } },
  });
  if (!issue) throw new CryptoOpsError("NOT_FOUND");

  if (issue.status === "RESOLVED") {
    return {
      issueId: issue.id,
      status: "RESOLVED",
      fingerprint: issue.fingerprint,
      symbol: issue.asset?.symbol ?? null,
      replayed: true,
    };
  }

  // INFO findings are not operator-actionable attention items.
  if (issue.severity === "INFO") {
    throw new CryptoOpsError(
      "VALIDATION_FAILED",
      "Informational findings are not resolved by operators. Re-run reconciliation instead.",
    );
  }

  const updated = await prisma.terminalCryptoReconciliationIssue.update({
    where: { id: issue.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: actor.id,
      resolutionNote: reason,
      resolutionSource: "operator",
    },
    include: { asset: { select: { symbol: true } } },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: actor.id,
    action: "TERMINAL_CRYPTO_RECON_ISSUE_RESOLVED",
    entityType: "TERMINAL_CRYPTO_RECON_ISSUE",
    entityId: updated.id,
    description: `Resolved ${updated.severity} issue (${updated.checkKey}): ${reason}`,
    metadata: {
      source: "OPERATOR",
      issueId: updated.id,
      fingerprint: updated.fingerprint,
      checkKey: updated.checkKey,
      severity: updated.severity,
      symbol: updated.asset?.symbol ?? null,
      reason,
      idempotencyKey: input.idempotencyKey,
      resolutionSource: "operator",
    },
  });

  return {
    issueId: updated.id,
    status: "RESOLVED",
    fingerprint: updated.fingerprint,
    symbol: updated.asset?.symbol ?? null,
    replayed: false,
  };
}

export async function reopenCryptoReconciliationIssue(
  actor: AltaUser,
  input: ReopenCryptoReconIssueInput,
): Promise<CryptoReconIssueActionResult> {
  if (!isCorporateAdmin(actor)) {
    throw new CryptoOpsError("FORBIDDEN");
  }
  const reason = requireNonemptyReason(input.reason);
  requireConfirmation(input.confirmed);
  requireIdempotencyKey(input.idempotencyKey);

  const issue = await prisma.terminalCryptoReconciliationIssue.findUnique({
    where: { id: input.issueId },
    include: { asset: { select: { symbol: true } } },
  });
  if (!issue) throw new CryptoOpsError("NOT_FOUND");

  if (issue.status === "OPEN") {
    return {
      issueId: issue.id,
      status: "OPEN",
      fingerprint: issue.fingerprint,
      symbol: issue.asset?.symbol ?? null,
      replayed: true,
    };
  }

  // Unique open-fingerprint constraint — refuse if another OPEN row shares fingerprint.
  const openTwin = await prisma.terminalCryptoReconciliationIssue.findFirst({
    where: { fingerprint: issue.fingerprint, status: "OPEN" },
    select: { id: true },
  });
  if (openTwin) {
    throw new CryptoOpsError(
      "VALIDATION_FAILED",
      "An open issue with this fingerprint already exists. Review that issue instead.",
    );
  }

  const updated = await prisma.terminalCryptoReconciliationIssue.update({
    where: { id: issue.id },
    data: {
      status: "OPEN",
      resolvedAt: null,
      resolvedByRunId: null,
      resolvedByUserId: actor.id,
      resolutionNote: reason,
      resolutionSource: "operator",
      lastSeenAt: new Date(),
    },
    include: { asset: { select: { symbol: true } } },
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: actor.id,
    action: "TERMINAL_CRYPTO_RECON_ISSUE_REOPENED",
    entityType: "TERMINAL_CRYPTO_RECON_ISSUE",
    entityId: updated.id,
    description: `Reopened ${updated.severity} issue (${updated.checkKey}): ${reason}`,
    metadata: {
      source: "OPERATOR",
      issueId: updated.id,
      fingerprint: updated.fingerprint,
      checkKey: updated.checkKey,
      severity: updated.severity,
      symbol: updated.asset?.symbol ?? null,
      reason,
      idempotencyKey: input.idempotencyKey,
      resolutionSource: "operator",
    },
  });

  return {
    issueId: updated.id,
    status: "OPEN",
    fingerprint: updated.fingerprint,
    symbol: updated.asset?.symbol ?? null,
    replayed: false,
  };
}
