import type { ScheduledManualInterestStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { parseBankScheduledDateTime } from "@/lib/scheduled-datetime";
import type {
  ExecuteScheduledManualInterestResult,
  ScheduleManualInterestResult,
  ScheduledManualInterestRow,
  StoredManualInterestPayload,
} from "@/lib/bank/manual-interest-scheduler-types";
import type { ManualInterestApplicationInput } from "@/lib/bank/manual-interest-types";
import { MANUAL_INTEREST_CATEGORY_OPTIONS } from "@/lib/bank/manual-interest-types";
import { applyManualInterestApplication } from "@/lib/bank/manual-interest-service";
import { writeAuditLog } from "@/server/audit.service";

function categoryLabelsFromPayload(payload: StoredManualInterestPayload): string[] {
  if (payload.accountTypes.includes("all")) {
    return ["All Categories"];
  }
  return payload.accountTypes.map((code) => {
    const match = MANUAL_INTEREST_CATEGORY_OPTIONS.find((option) => option.value === code);
    return match?.label ?? code;
  });
}

function parsePayload(raw: unknown): StoredManualInterestPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("BAD_REQUEST:Invalid scheduled interest payload.");
  }
  return raw as StoredManualInterestPayload;
}

export function resolveScheduledManualInterestRunAt(scheduledForDate: string): Date {
  const scheduledFor = parseBankScheduledDateTime(scheduledForDate);
  if (scheduledFor.getTime() <= Date.now()) {
    throw new Error("BAD_REQUEST:Schedule date must be in the future. Leave blank to apply immediately.");
  }
  return scheduledFor;
}

export async function scheduleManualInterestApplication(
  input: ManualInterestApplicationInput,
  actorUserId: string,
): Promise<ScheduleManualInterestResult> {
  if (!input.scheduledForDate?.trim()) {
    throw new Error("BAD_REQUEST:Schedule date is required for scheduling.");
  }
  if (!input.idempotencyKey) {
    throw new Error("BAD_REQUEST:Idempotency key is required.");
  }

  const scheduledFor = resolveScheduledManualInterestRunAt(input.scheduledForDate.trim());

  const existing = await prisma.scheduledManualInterestApplication.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return {
      scheduled: true,
      id: existing.id,
      scheduledFor: existing.scheduledFor.toISOString(),
      idempotencyKey: existing.idempotencyKey,
    };
  }

  const { scheduledForDate: _date, ...payload } = input;

  const record = await prisma.scheduledManualInterestApplication.create({
    data: {
      createdByUserId: actorUserId,
      payload,
      scheduledFor,
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "MANUAL_INTEREST_SCHEDULED",
    entityType: "BANK_ACCOUNT",
    entityId: record.id,
    description: `Scheduled manual interest for ${scheduledFor.toISOString().slice(0, 10)}`,
    metadata: {
      scheduledFor: scheduledFor.toISOString(),
      idempotencyKey: input.idempotencyKey,
      mode: input.mode,
      reason: input.reason,
      accountTypes: input.accountTypes,
    },
  });

  return {
    scheduled: true,
    id: record.id,
    scheduledFor: record.scheduledFor.toISOString(),
    idempotencyKey: record.idempotencyKey,
  };
}

export async function listScheduledManualInterestApplications(options?: {
  status?: ScheduledManualInterestStatus;
  limit?: number;
}): Promise<ScheduledManualInterestRow[]> {
  const rows = await prisma.scheduledManualInterestApplication.findMany({
    where: options?.status ? { status: options.status } : undefined,
    include: {
      createdBy: { select: { discordUsername: true } },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: options?.limit ?? 50,
  });

  return rows.map((row) => {
    const payload = parsePayload(row.payload);
    return {
      id: row.id,
      status: row.status,
      scheduledFor: row.scheduledFor.toISOString(),
      reason: payload.reason,
      mode: payload.mode,
      categoryLabels: categoryLabelsFromPayload(payload),
      createdByUsername: row.createdBy.discordUsername,
      createdAt: row.createdAt.toISOString(),
      batchReferenceId: row.batchReferenceId,
      failureReason: row.failureReason,
    };
  });
}

export async function cancelScheduledManualInterestApplication(
  id: string,
  actorUserId: string,
): Promise<void> {
  const record = await prisma.scheduledManualInterestApplication.findUnique({ where: { id } });
  if (!record) {
    throw new Error("BAD_REQUEST:Scheduled interest application not found.");
  }
  if (record.status !== "PENDING") {
    throw new Error("BAD_REQUEST:Only pending scheduled applications can be cancelled.");
  }

  await prisma.scheduledManualInterestApplication.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await writeAuditLog({
    actorUserId,
    action: "MANUAL_INTEREST_SCHEDULE_CANCELLED",
    entityType: "BANK_ACCOUNT",
    entityId: id,
    description: "Cancelled scheduled manual interest application",
  });
}

export async function executeDueScheduledManualInterest(options?: {
  now?: Date;
}): Promise<ExecuteScheduledManualInterestResult> {
  const now = options?.now ?? new Date();

  const due = await prisma.scheduledManualInterestApplication.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
  });

  let appliedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const record of due) {
    try {
      const payload = parsePayload(record.payload);
      const applyInput: ManualInterestApplicationInput = {
        ...payload,
        idempotencyKey: record.idempotencyKey,
      };

      const result = await applyManualInterestApplication(applyInput, record.createdByUserId);

      if (result.processedCount === 0 && result.failedCount === 0) {
        skippedCount += 1;
      } else if (result.failedCount > 0 && result.processedCount === 0) {
        failedCount += 1;
        await prisma.scheduledManualInterestApplication.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            failureReason: "All accounts failed or were skipped during apply",
            applyResult: result,
          },
        });
        continue;
      } else {
        appliedCount += 1;
      }

      await prisma.scheduledManualInterestApplication.update({
        where: { id: record.id },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          batchReferenceId: result.batchReferenceId,
          applyResult: result,
        },
      });
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.scheduledManualInterestApplication.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          failureReason: message.replace(/^BAD_REQUEST:/, ""),
        },
      });
    }
  }

  return {
    dueCount: due.length,
    appliedCount,
    failedCount,
    skippedCount,
  };
}
