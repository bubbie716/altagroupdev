import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

export type BulkActionResult = {
  processed: number;
  failed: number;
  results: { id: string; status: "ok" | "failed"; reason?: string }[];
};

export async function bulkApproveDeposits(
  actorUserId: string,
  transactionIds: string[],
  reviewNote?: string,
): Promise<BulkActionResult> {
  await requireOperator();
  const { approveDeposit } = await import("@/server/bank.service");
  const results: BulkActionResult["results"] = [];
  let processed = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      await approveDeposit(actorUserId, id, reviewNote);
      results.push({ id, status: "ok" });
      processed += 1;
    } catch (e) {
      failed += 1;
      results.push({ id, status: "failed", reason: e instanceof Error ? e.message : "Failed" });
    }
  }

  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId,
    action: "BULK_DEPOSITS_APPROVED",
    entityType: "BANK_TRANSACTION",
    description: `Bulk approved ${processed} deposit(s)`,
    metadata: { processed, failed, reviewNote: reviewNote ?? null },
  });

  return { processed, failed, results };
}

export async function bulkDenyDeposits(
  actorUserId: string,
  transactionIds: string[],
  reviewNote?: string,
): Promise<BulkActionResult> {
  await requireOperator();
  const { denyDeposit } = await import("@/server/bank.service");
  const results: BulkActionResult["results"] = [];
  let processed = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      await denyDeposit(actorUserId, id, reviewNote);
      results.push({ id, status: "ok" });
      processed += 1;
    } catch (e) {
      failed += 1;
      results.push({ id, status: "failed", reason: e instanceof Error ? e.message : "Failed" });
    }
  }

  return { processed, failed, results };
}

export async function bulkApproveWithdrawals(
  actorUserId: string,
  transactionIds: string[],
  reviewNote?: string,
): Promise<BulkActionResult> {
  await requireOperator();
  const { approveWithdrawal } = await import("@/server/bank.service");
  const results: BulkActionResult["results"] = [];
  let processed = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      await approveWithdrawal(actorUserId, id, reviewNote);
      results.push({ id, status: "ok" });
      processed += 1;
    } catch (e) {
      failed += 1;
      results.push({ id, status: "failed", reason: e instanceof Error ? e.message : "Failed" });
    }
  }

  return { processed, failed, results };
}

export async function bulkDenyWithdrawals(
  actorUserId: string,
  transactionIds: string[],
  reviewNote?: string,
): Promise<BulkActionResult> {
  await requireOperator();
  const { denyWithdrawal } = await import("@/server/bank.service");
  const results: BulkActionResult["results"] = [];
  let processed = 0;
  let failed = 0;

  for (const id of transactionIds) {
    try {
      await denyWithdrawal(actorUserId, id, reviewNote);
      results.push({ id, status: "ok" });
      processed += 1;
    } catch (e) {
      failed += 1;
      results.push({ id, status: "failed", reason: e instanceof Error ? e.message : "Failed" });
    }
  }

  return { processed, failed, results };
}

export async function bulkFreezeAccounts(
  actorUserId: string,
  accountIds: string[],
  reviewNote: string,
): Promise<BulkActionResult> {
  await requireOperator();
  const { freezeBankAccount } = await import("@/server/bank.service");
  const results: BulkActionResult["results"] = [];
  let processed = 0;
  let failed = 0;

  for (const id of accountIds) {
    try {
      await freezeBankAccount(actorUserId, id, reviewNote);
      results.push({ id, status: "ok" });
      processed += 1;
    } catch (e) {
      failed += 1;
      results.push({ id, status: "failed", reason: e instanceof Error ? e.message : "Failed" });
    }
  }

  return { processed, failed, results };
}

export async function exportAuditLogsCsv(filters: {
  q?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<string> {
  await requireOperator();
  const { queryAuditLogs } = await import("@/server/audit.service");
  const rows = await queryAuditLogs({ ...filters }, 5000);
  const header = "id,createdAt,actor,action,description,entityType,entityId\n";
  const body = rows
    .map((r) =>
      [r.id, r.createdAt, r.actorUsername, r.action, `"${r.description.replace(/"/g, '""')}"`, r.entityType, r.entityId ?? ""].join(","),
    )
    .join("\n");
  return header + body;
}
