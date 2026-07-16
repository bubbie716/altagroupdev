import { prisma } from "@/server/db";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { NccApiError, mapSettlementErrorToApi } from "@/lib/ncc/ncc-api-errors";
import { isRoutingNumberUsable } from "@/lib/ncc/ncc-permissions";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import {
  cancelInstruction,
  submitInstruction,
  type SettlementInstructionView,
} from "@/server/ncc/ncc-settlement.service";
import type { AuthenticatedNccApiContext } from "@/server/ncc/ncc-api-auth.service";

const SETTLEMENT_STATUSES = new Set([
  "CREATED",
  "SUBMITTED",
  "VALIDATING",
  "QUEUED",
  "SETTLING",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "REVERSED",
]);

const EXECUTION_STATUSES = new Set([
  "NOT_STARTED",
  "VALIDATING",
  "PREPARING_SOURCE",
  "SOURCE_PREPARED",
  "POSTING_NCC_LEDGER",
  "NCC_LEDGER_POSTED",
  "COMMITTING_SOURCE",
  "SOURCE_COMMITTED",
  "CREDITING_DESTINATION",
  "DESTINATION_CREDITED",
  "COMPLETED",
  "RETRY_PENDING",
  "MANUAL_REVIEW",
  "COMPENSATING",
  "COMPENSATED",
  "FAILED",
]);

export const NCC_API_STRING_LIMITS = {
  idempotencyKey: 128,
  purpose: 256,
  externalReference: 128,
  accountReference: 128,
  reason: 500,
} as const;

function assertOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new NccApiError("VALIDATION_ERROR", `${field} must be a string.`, 400);
  }
  if (value.length > maxLen) {
    throw new NccApiError("VALIDATION_ERROR", `${field} exceeds maximum length of ${maxLen}.`, 400);
  }
  return value;
}

function encodeListCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeListCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.lastIndexOf("|");
    if (sep <= 0) throw new Error("bad");
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (!id || Number.isNaN(createdAt.getTime())) throw new Error("bad");
    return { createdAt, id };
  } catch {
    throw new NccApiError("VALIDATION_ERROR", "cursor is invalid.", 400);
  }
}

export type ApiSettlementView = {
  reference: string;
  status: string;
  executionStatus: string | null;
  executionStep: string | null;
  amount: string;
  currency: string;
  sendingInstitution: { displayName: string; slug: string };
  receivingInstitution: { displayName: string; slug: string };
  submittedAt: string | null;
  nccPostedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  externalReference: string | null;
  purpose: string | null;
};

function parsePositiveMoneyString(amount: string): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new NccApiError("INVALID_AMOUNT", "Amount must be a positive decimal string.", 400);
  }
  const value = asDecimal(trimmed);
  if (value.lte(0)) throw new NccApiError("INVALID_AMOUNT", "Amount must be a positive decimal string.", 400);
  return value.toFixed(2);
}

async function mapApiSettlement(
  instructionId: string,
  viewerInstitutionId: string,
): Promise<ApiSettlementView> {
  const row = await prisma.settlementInstruction.findUniqueOrThrow({
    where: { id: instructionId },
    include: {
      sendingInstitution: { select: { displayName: true, slug: true } },
      receivingInstitution: { select: { displayName: true, slug: true } },
      execution: true,
    },
  });
  if (
    row.sendingInstitutionId !== viewerInstitutionId &&
    row.receivingInstitutionId !== viewerInstitutionId
  ) {
    throw new NccApiError("NOT_FOUND", "The requested resource was not found.", 404);
  }

  return {
    reference: row.publicReference,
    status: row.status,
    executionStatus: row.execution?.status ?? null,
    executionStep: row.execution?.currentStep ?? null,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    sendingInstitution: row.sendingInstitution,
    receivingInstitution: row.receivingInstitution,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    nccPostedAt: row.settledAt?.toISOString() ?? null,
    completedAt: row.execution?.completedAt?.toISOString() ?? null,
    failureCode: row.failureCode ?? row.execution?.failureCode ?? null,
    failureReason: row.failureReason ?? row.execution?.failureReason ?? null,
    externalReference: row.externalReference,
    purpose: row.purpose,
  };
}

export async function apiSubmitSettlement(
  ctx: AuthenticatedNccApiContext,
  input: {
    receivingRoutingNumber: string;
    amount: string;
    currency?: string;
    purpose?: string;
    externalReference?: string;
    sourceAccountReference?: string;
    destinationAccountReference?: string;
    idempotencyKey: string;
  },
): Promise<ApiSettlementView> {
  const amount = parsePositiveMoneyString(input.amount);
  const currency = (input.currency ?? NCC_DEFAULT_CURRENCY).toUpperCase();
  if (currency !== NCC_DEFAULT_CURRENCY) {
    throw new NccApiError("UNSUPPORTED_CURRENCY", "The currency is not supported.", 400);
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new NccApiError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required.", 400);
  }
  if (idempotencyKey.length > NCC_API_STRING_LIMITS.idempotencyKey) {
    throw new NccApiError(
      "VALIDATION_ERROR",
      `Idempotency-Key exceeds maximum length of ${NCC_API_STRING_LIMITS.idempotencyKey}.`,
      400,
    );
  }

  const purpose = assertOptionalString(input.purpose, "purpose", NCC_API_STRING_LIMITS.purpose);
  const externalReference = assertOptionalString(
    input.externalReference,
    "externalReference",
    NCC_API_STRING_LIMITS.externalReference,
  );
  const sourceAccountReference = assertOptionalString(
    input.sourceAccountReference,
    "sourceAccountReference",
    NCC_API_STRING_LIMITS.accountReference,
  );
  const destinationAccountReference = assertOptionalString(
    input.destinationAccountReference,
    "destinationAccountReference",
    NCC_API_STRING_LIMITS.accountReference,
  );

  const receivingRouting = await prisma.routingNumber.findUnique({
    where: { routingNumber: input.receivingRoutingNumber.trim() },
  });
  if (!receivingRouting || !isRoutingNumberUsable(receivingRouting.status)) {
    throw new NccApiError("INVALID_ROUTING", "Receiving routing number is invalid or unusable.", 422);
  }

  const sendingRouting = await prisma.routingNumber.findFirst({
    where: { institutionId: ctx.institutionId, isPrimary: true, status: "ACTIVE" },
  });
  if (!sendingRouting) {
    throw new NccApiError("INVALID_ROUTING", "Sending institution has no active primary routing number.", 422);
  }

  if (receivingRouting.institutionId === ctx.institutionId) {
    throw new NccApiError("SELF_SETTLEMENT_DENIED", "Self-settlement is not permitted.", 422);
  }

  // Actor for audit: prefer credential creator, else primary contact, else system user fallback.
  const actorUserId =
    ctx.credential.createdByUserId ??
    ctx.institution.primaryContactUserId ??
    (
      await prisma.user.findFirst({
        where: { tags: { some: { tag: "ADMIN" } } },
        select: { id: true },
      })
    )?.id;
  if (!actorUserId) {
    throw new NccApiError("INTERNAL_ERROR", "No actor available for settlement submission.", 500);
  }

  try {
    const instruction = await submitInstruction({
      sendingInstitutionId: ctx.institutionId,
      receivingInstitutionId: receivingRouting.institutionId,
      sendingRoutingNumberId: sendingRouting.id,
      receivingRoutingNumberId: receivingRouting.id,
      amount: Number(amount),
      currency,
      purpose,
      externalReference,
      idempotencyKey,
      submittedByUserId: actorUserId,
      metadata: {
        source: "ncc_api",
        credentialId: ctx.credentialId,
        sourceAccountReference,
        destinationAccountReference,
      },
    });
    return mapApiSettlement(instruction.id, ctx.institutionId);
  } catch (error) {
    throw mapSettlementErrorToApi(error);
  }
}

export async function apiGetSettlement(
  ctx: AuthenticatedNccApiContext,
  reference: string,
): Promise<ApiSettlementView> {
  const row = await prisma.settlementInstruction.findUnique({
    where: { publicReference: reference },
  });
  if (!row) throw new NccApiError("NOT_FOUND", "The requested resource was not found.", 404);
  return mapApiSettlement(row.id, ctx.institutionId);
}

export async function apiListSettlements(
  ctx: AuthenticatedNccApiContext,
  options?: {
    status?: string;
    executionStatus?: string;
    direction?: string;
    cursor?: string;
    limit?: number | string;
  },
): Promise<{ items: ApiSettlementView[]; nextCursor: string | null }> {
  let limit = 25;
  if (options?.limit !== undefined && options.limit !== null && options.limit !== "") {
    const parsed =
      typeof options.limit === "number" ? options.limit : Number(options.limit);
    if (!Number.isInteger(parsed) || !Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      throw new NccApiError("VALIDATION_ERROR", "limit must be an integer between 1 and 100.", 400);
    }
    limit = parsed;
  }

  if (options?.status !== undefined && options.status !== null && options.status !== "") {
    if (!SETTLEMENT_STATUSES.has(options.status)) {
      throw new NccApiError("VALIDATION_ERROR", "status is not a supported settlement status.", 400);
    }
  }
  if (
    options?.executionStatus !== undefined &&
    options.executionStatus !== null &&
    options.executionStatus !== ""
  ) {
    if (!EXECUTION_STATUSES.has(options.executionStatus)) {
      throw new NccApiError(
        "VALIDATION_ERROR",
        "executionStatus is not a supported execution status.",
        400,
      );
    }
  }

  let direction: "sent" | "received" | undefined;
  if (options?.direction !== undefined && options.direction !== null && options.direction !== "") {
    if (options.direction !== "sent" && options.direction !== "received") {
      throw new NccApiError("VALIDATION_ERROR", "direction must be 'sent' or 'received'.", 400);
    }
    direction = options.direction;
  }

  let cursorFilter: { createdAt: Date; id: string } | null = null;
  if (options?.cursor) {
    cursorFilter = decodeListCursor(options.cursor);
    const exists = await prisma.settlementInstruction.findFirst({
      where: {
        id: cursorFilter.id,
        createdAt: cursorFilter.createdAt,
        OR: [
          { sendingInstitutionId: ctx.institutionId },
          { receivingInstitutionId: ctx.institutionId },
        ],
      },
      select: { id: true },
    });
    if (!exists) {
      throw new NccApiError("VALIDATION_ERROR", "cursor does not exist for this institution.", 400);
    }
  }

  const where = {
    AND: [
      direction === "sent"
        ? { sendingInstitutionId: ctx.institutionId }
        : direction === "received"
          ? { receivingInstitutionId: ctx.institutionId }
          : {
              OR: [
                { sendingInstitutionId: ctx.institutionId },
                { receivingInstitutionId: ctx.institutionId },
              ],
            },
      options?.status ? { status: options.status as never } : {},
      options?.executionStatus
        ? { execution: { status: options.executionStatus as never } }
        : {},
      cursorFilter
        ? {
            OR: [
              { createdAt: { lt: cursorFilter.createdAt } },
              { createdAt: cursorFilter.createdAt, id: { lt: cursorFilter.id } },
            ],
          }
        : {},
    ],
  };

  const rows = await prisma.settlementInstruction.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: { id: true, createdAt: true },
  });
  const page = rows.slice(0, limit);
  const items = await Promise.all(page.map((row) => mapApiSettlement(row.id, ctx.institutionId)));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeListCursor(last.createdAt, last.id) : null;
  return { items, nextCursor };
}

export async function apiCancelSettlement(
  ctx: AuthenticatedNccApiContext,
  reference: string,
  reason: string,
): Promise<ApiSettlementView> {
  const row = await prisma.settlementInstruction.findUnique({
    where: { publicReference: reference },
  });
  if (!row || row.sendingInstitutionId !== ctx.institutionId) {
    throw new NccApiError("NOT_FOUND", "The requested resource was not found.", 404);
  }
  const actorUserId =
    ctx.credential.createdByUserId ??
    ctx.institution.primaryContactUserId ??
    (
      await prisma.user.findFirst({
        where: { tags: { some: { tag: "ADMIN" } } },
        select: { id: true },
      })
    )?.id;
  if (!actorUserId) throw new NccApiError("INTERNAL_ERROR", "No actor available.", 500);

  const cancelReason = (reason || "API cancellation").trim();
  if (cancelReason.length > NCC_API_STRING_LIMITS.reason) {
    throw new NccApiError(
      "VALIDATION_ERROR",
      `reason exceeds maximum length of ${NCC_API_STRING_LIMITS.reason}.`,
      400,
    );
  }

  try {
    const cancelled = await cancelInstruction(row.id, actorUserId, cancelReason);
    return mapApiSettlement(cancelled.id, ctx.institutionId);
  } catch (error) {
    const mapped = mapSettlementErrorToApi(error);
    if (
      mapped.code === "CANCEL_AFTER_SETTLEMENT_DENIED" ||
      mapped.code === "CANCEL_WHILE_SETTLING_DENIED" ||
      mapped.code === "CANCEL_AFTER_PREPARATION_DENIED"
    ) {
      throw new NccApiError("CANCEL_TOO_LATE", "Cancellation is no longer permitted for this settlement.", 409);
    }
    throw mapped;
  }
}

/**
 * Safer default: institution API creates a reversal request for NCC ops review
 * rather than immediately reversing value.
 */
export async function apiRequestReversal(
  ctx: AuthenticatedNccApiContext,
  reference: string,
  reason: string,
): Promise<{
  requestId: string;
  reference: string;
  status: string;
  reason: string;
}> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new NccApiError("REVERSAL_REASON_REQUIRED", "A non-empty reversal reason is required.", 400);
  }
  if (trimmed.length > NCC_API_STRING_LIMITS.reason) {
    throw new NccApiError(
      "VALIDATION_ERROR",
      `reason exceeds maximum length of ${NCC_API_STRING_LIMITS.reason}.`,
      400,
    );
  }
  const row = await prisma.settlementInstruction.findUnique({
    where: { publicReference: reference },
  });
  if (
    !row ||
    (row.sendingInstitutionId !== ctx.institutionId && row.receivingInstitutionId !== ctx.institutionId)
  ) {
    throw new NccApiError("NOT_FOUND", "The requested resource was not found.", 404);
  }
  if (row.status !== "SETTLED") {
    throw new NccApiError("REVERSAL_REQUIRES_SETTLED", "Reversal requires a SETTLED instruction.", 409);
  }

  const request = await prisma.nccSettlementReversalRequest.create({
    data: {
      institutionId: ctx.institutionId,
      settlementInstructionId: row.id,
      publicReference: row.publicReference,
      reason: trimmed,
      status: "PENDING_REVIEW",
      requestedByCredentialId: ctx.credentialId,
      requestedByUserId: ctx.credential.createdByUserId,
    },
  });

  const actorUserId =
    ctx.credential.createdByUserId ??
    (
      await prisma.user.findFirst({
        where: { tags: { some: { tag: "ADMIN" } } },
        select: { id: true },
      })
    )?.id;
  if (actorUserId) {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId,
      action: NCC_AUDIT.REVERSAL_REQUESTED,
      entityType: "NCC_REVERSAL_REQUEST",
      entityId: request.id,
      institutionId: ctx.institutionId,
      description: `API reversal request for ${row.publicReference}`,
      metadata: { reason: trimmed },
    });
  }

  return {
    requestId: request.id,
    reference: row.publicReference,
    status: request.status,
    reason: trimmed,
  };
}

export async function apiGetInstitution(ctx: AuthenticatedNccApiContext) {
  return {
    id: ctx.institution.id,
    legalName: ctx.institution.legalName,
    displayName: ctx.institution.displayName,
    slug: ctx.institution.slug,
    status: ctx.institution.status,
    institutionType: ctx.institution.institutionType,
    isNCCParticipant: ctx.institution.isNCCParticipant,
  };
}

export async function apiListRoutingNumbers(ctx: AuthenticatedNccApiContext) {
  const rows = await prisma.routingNumber.findMany({
    where: { institutionId: ctx.institutionId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    routingNumber: row.routingNumber,
    status: row.status,
    isPrimary: row.isPrimary,
    label: row.label,
  }));
}

export async function apiListSettlementAccounts(ctx: AuthenticatedNccApiContext) {
  const rows = await prisma.settlementAccount.findMany({
    where: { institutionId: ctx.institutionId },
    orderBy: { currency: "asc" },
  });
  return rows.map((row) => ({
    currency: row.currency,
    status: row.status,
    ledgerBalance: row.ledgerBalance.toFixed(2),
    availableBalance: row.availableBalance.toFixed(2),
  }));
}

export type { SettlementInstructionView };
