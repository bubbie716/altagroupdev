/**
 * Institution adapter boundary — NCC must not call institution DB mutation helpers
 * directly outside this abstraction.
 *
 * Sprint 4A: public payment addresses are routing number + opaque,
 * institution-specific account identifier. NCC does not standardize identifier
 * formats across participants. Adapters resolve identifiers to opaque internal
 * references. Debit/credit operations continue to use those internal references only.
 */

export type InstitutionAdapterKey = "alta-bank" | "alta-exchange" | "alta-terminal" | string;

export type AdapterValidationResult =
  | { ok: true; accountReference: string }
  | { ok: false; code: string; reason: string };

export type AdapterPreparationResult =
  | { ok: true; holdReference: string }
  | { ok: false; code: string; reason: string };

export type AdapterCommitResult =
  | { ok: true; externalReference: string }
  | { ok: false; code: string; reason: string };

export type AdapterCreditResult =
  | { ok: true; credited: boolean; externalReference?: string }
  | { ok: false; code: string; reason: string };

export type AccountResolutionDirection = "debit" | "credit";

/**
 * Successful account resolution — internal reference must never appear in public
 * API responses, webhook payloads, request logs, or portal URLs.
 */
export type AdapterAccountResolution = {
  internalAccountReference: string;
  canonicalAccountNumber: string;
  maskedAccountNumber: string;
  currency: string;
  status: string;
  debitEligible: boolean;
  creditEligible: boolean;
  /** Optional minimal beneficiary label for name-check (never a balance). */
  beneficiaryLabel?: string | null;
  resolvedAt: string;
  resolverKey: string;
};

export type AdapterResolveResult =
  | { ok: true; account: AdapterAccountResolution }
  | { ok: false; code: string; reason: string };

export type InstitutionAdapterDebitInput = {
  settlementInstructionId: string;
  publicReference: string;
  /**
   * Decimal amount serialized as a string (e.g. "125.00"). Adapters must parse
   * with Prisma.Decimal / ncc-money helpers — never coerce through JS float math.
   */
  amount: string;
  currency: string;
  /**
   * Opaque internal adapter account reference from resolveAccount().
   * Omitted for pure inter-institution float movements.
   */
  accountReference?: string;
  /** Acting user for audit/hold attribution. Falls back to the account owner when omitted. */
  actorUserId?: string;
  metadata?: Record<string, unknown>;
};

export type InstitutionAdapterCreditInput = {
  settlementInstructionId: string;
  publicReference: string;
  /** Decimal amount serialized as a string — see InstitutionAdapterDebitInput. */
  amount: string;
  currency: string;
  accountReference?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
};

export interface InstitutionAdapter {
  institutionKey: InstitutionAdapterKey;
  /**
   * Resolve a public institution-scoped account identifier to an opaque internal
   * reference. `accountNumber` is an opaque institution-specific string (API field
   * name retained for v1). Must not treat Prisma IDs as payment addresses.
   * Normalization / format rules belong entirely to this adapter.
   */
  resolveAccount(input: {
    /** Opaque institution-specific account identifier (public API: *AccountNumber). */
    accountNumber: string;
    currency: string;
    direction: AccountResolutionDirection;
  }): Promise<AdapterResolveResult>;
  /**
   * Validate an already-resolved internal account reference (execution resume /
   * historical settlements).
   */
  validateAccountReference(input: {
    accountReference: string;
  }): Promise<AdapterValidationResult>;
  prepareDebit(input: InstitutionAdapterDebitInput): Promise<AdapterPreparationResult>;
  commitDebit(input: InstitutionAdapterDebitInput & { holdReference: string }): Promise<AdapterCommitResult>;
  releaseDebit(input: { holdReference: string; settlementInstructionId: string }): Promise<void>;
  /**
   * Restores customer value after a committed source debit when post-ledger
   * destination credit cannot complete. Idempotent on settlementInstructionId.
   * Institution-float legs (no accountReference) are no-ops.
   */
  compensateDebit(input: InstitutionAdapterDebitInput): Promise<AdapterCommitResult>;
  notifyCredit(input: InstitutionAdapterCreditInput): Promise<AdapterCreditResult>;
}
