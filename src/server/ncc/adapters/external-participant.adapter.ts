import { prisma } from "@/server/db";
import { resolveFromActiveDirectory } from "@/server/ncc/ncc-directory.service";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";
import type {
  AdapterCommitResult,
  AdapterCreditResult,
  AdapterPreparationResult,
  AdapterResolveResult,
  AdapterValidationResult,
  InstitutionAdapter,
  InstitutionAdapterCreditInput,
  InstitutionAdapterDebitInput,
} from "@/server/ncc/institution-adapter";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function confirmedSuccess(body: Record<string, unknown>): boolean {
  const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
  if (status === "FAILED" || status === "REJECTED" || status === "ERROR") return false;
  if (body.ok === false || body.success === false || body.credited === false) return false;
  if (body.ok === true || body.success === true || body.credited === true) return true;
  if (
    status === "OK" ||
    status === "SUCCESS" ||
    status === "SUCCEEDED" ||
    status === "COMMITTED" ||
    status === "CREDITED" ||
    status === "COMPENSATED" ||
    status === "RELEASED"
  ) {
    return true;
  }
  // Explicit external reference without a failure status is accepted as confirmation.
  return !!nonEmptyString(body.externalReference);
}

async function recoverAmbiguous(input: {
  baseUrl: string;
  authSecretEncrypted: string | null;
  timeoutMs: number;
  settlementInstructionId: string;
  idempotencyKey: string;
  expectedStatuses: string[];
}): Promise<AdapterCommitResult> {
  const status = await callExternalConnector({
    baseUrl: input.baseUrl,
    authSecretEncrypted: input.authSecretEncrypted,
    timeoutMs: input.timeoutMs,
    op: "queryStatus",
    body: {
      requestId: `status_${input.settlementInstructionId}`,
      idempotencyKey: input.idempotencyKey,
    },
  });
  if (!status.ok) {
    return {
      ok: false,
      code: status.ambiguous ? "CONNECTOR_TIMEOUT" : status.code,
      reason: status.reason,
    };
  }
  const opStatus =
    typeof status.body.status === "string" ? status.body.status.toUpperCase() : "";
  const externalReference = nonEmptyString(status.body.externalReference);
  if (input.expectedStatuses.includes(opStatus) && externalReference) {
    return { ok: true, externalReference };
  }
  return {
    ok: false,
    code: "CONNECTOR_STATUS_UNCONFIRMED",
    reason: "Operation status not confirmed after ambiguous timeout",
  };
}

/**
 * External bank adapter — resolves via API connector and/or uploaded directory.
 * Money movement always requires a certified API connector; directory alone never posts money.
 * Never invents hold/external references from incomplete responses.
 */
export class ExternalParticipantAdapter implements InstitutionAdapter {
  institutionKey: string;

  constructor(private readonly institutionId: string, key?: string) {
    this.institutionKey = key ?? `external:${institutionId}`;
  }

  private async connector() {
    return prisma.nccParticipantConnector.findUnique({
      where: { institutionId: this.institutionId },
    });
  }

  private async primaryRoutingNumber(): Promise<string | null> {
    const row = await prisma.routingNumber.findFirst({
      where: {
        institutionId: this.institutionId,
        status: { in: ["ACTIVE", "RESERVED"] },
        isPrimary: true,
      },
    });
    return row?.routingNumber ?? null;
  }

  async resolveAccount(input: {
    accountNumber: string;
    currency: string;
    direction: "debit" | "credit";
  }): Promise<AdapterResolveResult> {
    const connector = await this.connector();
    if (!connector || connector.status === "DISABLED" || connector.status === "DRAFT") {
      return {
        ok: false,
        code:
          input.direction === "debit"
            ? "SOURCE_ADAPTER_UNAVAILABLE"
            : "DESTINATION_ADAPTER_UNAVAILABLE",
        reason: "Connector unavailable",
      };
    }

    if (connector.mode === "DIRECTORY" || !connector.baseUrl) {
      const resolved = await resolveFromActiveDirectory({
        institutionId: this.institutionId,
        accountIdentifier: input.accountNumber,
        currency: input.currency,
        direction: input.direction,
      });
      if (!resolved.ok) {
        return { ok: false, code: resolved.code, reason: "Account unavailable" };
      }
      return {
        ok: true,
        account: {
          internalAccountReference: resolved.participantAccountReference,
          canonicalAccountNumber: resolved.canonicalIdentifier,
          maskedAccountNumber: resolved.maskedIdentifier,
          currency: input.currency.toUpperCase(),
          status: resolved.status,
          debitEligible: resolved.canDebit,
          creditEligible: resolved.canCredit,
          beneficiaryLabel: resolved.beneficiaryLabel,
          resolvedAt: new Date().toISOString(),
          resolverKey: `external-directory@1`,
        },
      };
    }

    const routingNumber = await this.primaryRoutingNumber();
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "resolve",
      body: {
        requestId: `resolve_${Date.now()}`,
        routingNumber,
        accountIdentifier: input.accountNumber,
        currency: input.currency.toUpperCase(),
        direction: input.direction === "debit" ? "DEBIT" : "CREDIT",
      },
    });
    if (!result.ok) {
      return { ok: false, code: result.code, reason: result.reason };
    }
    const body = result.body;
    const participantAccountReference = nonEmptyString(body.participantAccountReference);
    if (body.status !== "RESOLVED" || !participantAccountReference) {
      return { ok: false, code: "ACCOUNT_UNAVAILABLE", reason: "Malformed resolve response" };
    }
    const canDebit = Boolean(body.canDebit);
    const canCredit = Boolean(body.canCredit);
    if (input.direction === "debit" && !canDebit) {
      return { ok: false, code: "ACCOUNT_NOT_DEBITABLE", reason: "Not debitable" };
    }
    if (input.direction === "credit" && !canCredit) {
      return { ok: false, code: "ACCOUNT_NOT_CREDITABLE", reason: "Not creditable" };
    }
    return {
      ok: true,
      account: {
        internalAccountReference: participantAccountReference,
        canonicalAccountNumber: nonEmptyString(body.canonicalIdentifier) ?? input.accountNumber,
        maskedAccountNumber: nonEmptyString(body.maskedIdentifier) ?? "****",
        currency: input.currency.toUpperCase(),
        status: "ACTIVE",
        debitEligible: canDebit,
        creditEligible: canCredit,
        beneficiaryLabel: null,
        resolvedAt: new Date().toISOString(),
        resolverKey: "external-api@1",
      },
    };
  }

  async validateAccountReference(input: {
    accountReference: string;
  }): Promise<AdapterValidationResult> {
    if (!input.accountReference?.trim()) {
      return { ok: false, code: "INVALID_ACCOUNT_REF", reason: "Account reference required" };
    }
    return { ok: true, accountReference: input.accountReference };
  }

  private async requireMoneyConnector(opts?: { allowCertificationInProgress?: boolean }) {
    const connector = await this.connector();
    if (
      !connector ||
      connector.mode !== "API" ||
      !connector.baseUrl ||
      connector.status === "DISABLED"
    ) {
      return null;
    }
    const certOk =
      connector.certificationStatus === "PASSED" ||
      (opts?.allowCertificationInProgress && connector.certificationStatus === "IN_PROGRESS");
    if (!certOk) return null;
    return connector;
  }

  /** Certification harness may exercise money ops while status is IN_PROGRESS. */
  prepareDebitForCertification(input: InstitutionAdapterDebitInput) {
    return this.prepareDebit(input, { allowCertificationInProgress: true });
  }
  commitDebitForCertification(input: InstitutionAdapterDebitInput & { holdReference: string }) {
    return this.commitDebit(input, { allowCertificationInProgress: true });
  }
  releaseDebitForCertification(input: { holdReference: string; settlementInstructionId: string }) {
    return this.releaseDebit(input, { allowCertificationInProgress: true });
  }
  compensateDebitForCertification(input: InstitutionAdapterDebitInput) {
    return this.compensateDebit(input, { allowCertificationInProgress: true });
  }
  notifyCreditForCertification(input: InstitutionAdapterCreditInput) {
    return this.notifyCredit(input, { allowCertificationInProgress: true });
  }

  async prepareDebit(
    input: InstitutionAdapterDebitInput,
    opts?: { allowCertificationInProgress?: boolean },
  ): Promise<AdapterPreparationResult> {
    const connector = await this.requireMoneyConnector(opts);
    if (!connector) {
      return {
        ok: false,
        code: "SOURCE_ADAPTER_UNAVAILABLE",
        reason: "Certified API connector required for debit",
      };
    }
    if (!input.accountReference) {
      return {
        ok: false,
        code: "ACCOUNT_REFERENCE_REQUIRED",
        reason: "External participants require an opaque account reference for debit",
      };
    }
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl!,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "prepareDebit",
      body: {
        requestId: `prep_${input.settlementInstructionId}`,
        publicReference: input.publicReference,
        idempotencyKey: `prep:${input.settlementInstructionId}`,
        amount: input.amount,
        currency: input.currency,
        participantAccountReference: input.accountReference,
        timestamp: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      return { ok: false, code: result.code, reason: result.reason };
    }
    const holdReference = nonEmptyString(result.body.holdReference);
    if (!holdReference) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Prepare debit response missing holdReference",
      };
    }
    return { ok: true, holdReference };
  }

  async commitDebit(
    input: InstitutionAdapterDebitInput & { holdReference: string },
    opts?: { allowCertificationInProgress?: boolean },
  ): Promise<AdapterCommitResult> {
    const connector = await this.requireMoneyConnector(opts);
    if (!connector) {
      return { ok: false, code: "SOURCE_ADAPTER_UNAVAILABLE", reason: "Connector unavailable" };
    }
    if (!input.accountReference) {
      return {
        ok: false,
        code: "ACCOUNT_REFERENCE_REQUIRED",
        reason: "External participants require an opaque account reference for commit",
      };
    }
    const idempotencyKey = `commit:${input.settlementInstructionId}`;
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl!,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "commitDebit",
      body: {
        requestId: `commit_${input.settlementInstructionId}`,
        publicReference: input.publicReference,
        idempotencyKey,
        holdReference: input.holdReference,
        amount: input.amount,
        currency: input.currency,
        participantAccountReference: input.accountReference,
        timestamp: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      if (result.ambiguous) {
        return recoverAmbiguous({
          baseUrl: connector.baseUrl!,
          authSecretEncrypted: connector.authSecretEncrypted,
          timeoutMs: connector.timeoutMs,
          settlementInstructionId: input.settlementInstructionId,
          idempotencyKey,
          expectedStatuses: ["COMMITTED", "SUCCEEDED", "SUCCESS", "OK"],
        });
      }
      return { ok: false, code: result.code, reason: result.reason };
    }
    if (!confirmedSuccess(result.body)) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Commit debit response did not confirm success",
      };
    }
    const externalReference = nonEmptyString(result.body.externalReference);
    if (!externalReference) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Commit debit response missing externalReference",
      };
    }
    return { ok: true, externalReference };
  }

  async releaseDebit(
    input: {
      holdReference: string;
      settlementInstructionId: string;
    },
    opts?: { allowCertificationInProgress?: boolean },
  ): Promise<void> {
    const connector = await this.requireMoneyConnector(opts);
    if (!connector?.baseUrl) {
      throw new Error("SOURCE_ADAPTER_UNAVAILABLE");
    }
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "releaseDebit",
      body: {
        requestId: `release_${input.settlementInstructionId}`,
        idempotencyKey: `release:${input.settlementInstructionId}`,
        holdReference: input.holdReference,
      },
    });
    if (!result.ok) {
      throw new Error(result.reason);
    }
  }

  async compensateDebit(
    input: InstitutionAdapterDebitInput,
    opts?: { allowCertificationInProgress?: boolean },
  ): Promise<AdapterCommitResult> {
    const connector = await this.requireMoneyConnector(opts);
    if (!connector?.baseUrl) {
      return {
        ok: false,
        code: "SOURCE_ADAPTER_UNAVAILABLE",
        reason: "Certified API connector required for compensation",
      };
    }
    if (!input.accountReference) {
      return {
        ok: false,
        code: "ACCOUNT_REFERENCE_REQUIRED",
        reason: "External participants require an opaque account reference for compensation",
      };
    }
    const idempotencyKey = `compensate:${input.settlementInstructionId}`;
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "compensateDebit",
      body: {
        requestId: `comp_${input.settlementInstructionId}`,
        publicReference: input.publicReference,
        idempotencyKey,
        amount: input.amount,
        currency: input.currency,
        participantAccountReference: input.accountReference,
        timestamp: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      if (result.ambiguous) {
        return recoverAmbiguous({
          baseUrl: connector.baseUrl,
          authSecretEncrypted: connector.authSecretEncrypted,
          timeoutMs: connector.timeoutMs,
          settlementInstructionId: input.settlementInstructionId,
          idempotencyKey,
          expectedStatuses: ["COMPENSATED", "SUCCEEDED", "SUCCESS", "OK"],
        });
      }
      return { ok: false, code: result.code, reason: result.reason };
    }
    if (!confirmedSuccess(result.body)) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Compensation response did not confirm success",
      };
    }
    const externalReference = nonEmptyString(result.body.externalReference);
    if (!externalReference) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Compensation response missing externalReference",
      };
    }
    return { ok: true, externalReference };
  }

  async notifyCredit(
    input: InstitutionAdapterCreditInput,
    opts?: { allowCertificationInProgress?: boolean },
  ): Promise<AdapterCreditResult> {
    const connector = await this.requireMoneyConnector(opts);
    if (!connector?.baseUrl) {
      return {
        ok: false,
        code: "DESTINATION_ADAPTER_UNAVAILABLE",
        reason: "Certified API connector required for credit",
      };
    }
    if (!input.accountReference) {
      return {
        ok: false,
        code: "ACCOUNT_REFERENCE_REQUIRED",
        reason: "External participants require an opaque account reference for credit",
      };
    }
    const idempotencyKey = `credit:${input.settlementInstructionId}`;
    const result = await callExternalConnector({
      baseUrl: connector.baseUrl,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "credit",
      body: {
        requestId: `credit_${input.settlementInstructionId}`,
        publicReference: input.publicReference,
        idempotencyKey,
        amount: input.amount,
        currency: input.currency,
        participantAccountReference: input.accountReference,
        timestamp: new Date().toISOString(),
      },
    });
    if (!result.ok) {
      if (result.ambiguous) {
        const recovered = await recoverAmbiguous({
          baseUrl: connector.baseUrl,
          authSecretEncrypted: connector.authSecretEncrypted,
          timeoutMs: connector.timeoutMs,
          settlementInstructionId: input.settlementInstructionId,
          idempotencyKey,
          expectedStatuses: ["CREDITED", "SUCCEEDED", "SUCCESS", "OK", "COMMITTED"],
        });
        if (!recovered.ok) {
          return { ok: false, code: recovered.code, reason: recovered.reason };
        }
        return { ok: true, credited: true, externalReference: recovered.externalReference };
      }
      return { ok: false, code: result.code, reason: result.reason };
    }
    if (!confirmedSuccess(result.body)) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Credit response did not confirm success",
      };
    }
    const externalReference = nonEmptyString(result.body.externalReference);
    if (!externalReference) {
      return {
        ok: false,
        code: "MALFORMED_CONNECTOR_RESPONSE",
        reason: "Credit response missing externalReference",
      };
    }
    return { ok: true, credited: true, externalReference };
  }
}
