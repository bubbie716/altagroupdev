import { createHash } from "node:crypto";
import { prisma } from "@/server/db";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type FinancialIdempotencyScope =
  | "internal_transfer"
  | "alta_pay"
  | "alta_pay_person"
  | "terminal_funding"
  | "terminal_crypto_order"
  | "terminal_crypto_lifecycle"
  | "terminal_crypto_revenue_sweep"
  | "terminal_crypto_contribution"
  | "terminal_crypto_reconciliation"
  | "terminal_crypto_fee_config";

/** Insertion-order-independent JSON for financial request hashes. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function stableHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_CONFLICT");
    this.name = "IdempotencyConflictError";
  }
}

/**
 * Mark in-memory replay responses without mutating stored first-response JSON.
 * Only applies when the stored result is an object that already declares `replayed`
 * (crypto order / lifecycle / sweep / contribution). Other financial scopes unchanged.
 */
export function markFinancialIdempotencyReplay<TResult>(stored: TResult): TResult {
  if (
    stored !== null &&
    typeof stored === "object" &&
    !Array.isArray(stored) &&
    Object.prototype.hasOwnProperty.call(stored, "replayed") &&
    typeof (stored as { replayed: unknown }).replayed === "boolean"
  ) {
    return { ...(stored as object), replayed: true } as TResult;
  }
  return stored;
}

export async function beginFinancialIdempotency<TPayload extends object, TResult>(input: {
  userId: string;
  scope: FinancialIdempotencyScope;
  idempotencyKey?: string | null;
  payload: TPayload;
  ttlMs?: number;
  execute: () => Promise<TResult>;
}): Promise<TResult> {
  const key = input.idempotencyKey?.trim();
  if (!key) {
    return input.execute();
  }

  const requestHash = stableHash(input.payload);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));

  const existing = await prisma.financialIdempotencyRecord.findUnique({
    where: {
      userId_scope_idempotencyKey: {
        userId: input.userId,
        scope: input.scope,
        idempotencyKey: key,
      },
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }
    return markFinancialIdempotencyReplay(JSON.parse(existing.resultJson) as TResult);
  }

  const result = await input.execute();

  try {
    await prisma.financialIdempotencyRecord.create({
      data: {
        userId: input.userId,
        scope: input.scope,
        idempotencyKey: key,
        requestHash,
        resultJson: JSON.stringify(result),
        expiresAt,
      },
    });
  } catch (error) {
    const retry = await prisma.financialIdempotencyRecord.findUnique({
      where: {
        userId_scope_idempotencyKey: {
          userId: input.userId,
          scope: input.scope,
          idempotencyKey: key,
        },
      },
    });
    if (retry) {
      if (retry.requestHash !== requestHash) throw new IdempotencyConflictError();
      // Concurrent creator lost the insert race — return the winner's stored result as replay.
      return markFinancialIdempotencyReplay(JSON.parse(retry.resultJson) as TResult);
    }
    throw error;
  }

  return result;
}
