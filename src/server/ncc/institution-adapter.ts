/**
 * Institution adapter boundary — NCC must not call institution DB mutation helpers
 * directly outside this abstraction.
 *
 * Sprint 3A: alta-bank / alta-terminal / alta-exchange adapters are real
 * implementations against BankAccount / TerminalCashAccount ledgers. External
 * (non-Alta) institutions will implement the same contract behind authenticated
 * adapters in a later sprint.
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
   * Customer account reference (BankAccount.id / TerminalCashAccount.id) when this
   * settlement leg touches a customer ledger. Omitted for pure inter-institution
   * float movements — adapters must treat this as an NCC-only no-op, not an error.
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
