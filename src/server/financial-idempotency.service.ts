import { createHash } from "node:crypto";
import { prisma } from "@/server/db";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type FinancialIdempotencyScope = "internal_transfer" | "alta_pay" | "alta_pay_person";

function stableHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_CONFLICT");
    this.name = "IdempotencyConflictError";
  }
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
    return JSON.parse(existing.resultJson) as TResult;
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
      return JSON.parse(retry.resultJson) as TResult;
    }
    throw error;
  }

  return result;
}
