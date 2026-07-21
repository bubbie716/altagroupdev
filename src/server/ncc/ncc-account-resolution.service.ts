import { encryptSecret } from "@/server/crypto";
import {
  addressingErrorMessage,
  NCC_ADDRESSING_ERROR,
  sanitizeAddressingFailureCode,
} from "@/lib/ncc/ncc-addressing-errors";
import { validateNccAccountIdentifierEnvelope } from "@/lib/ncc/ncc-account-number";
import type { AdapterAccountResolution } from "@/server/ncc/institution-adapter";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import { NccSettlementError } from "@/server/ncc/ncc-settlement-ledger.service";

export type ResolvedSettlementAddresses = {
  sourceInternalReference: string | null;
  destinationInternalReference: string | null;
  sourceAccountNumberMasked: string | null;
  destinationAccountNumberMasked: string | null;
  sourceAccountNumberEncrypted: string | null;
  destinationAccountNumberEncrypted: string | null;
  sourceCanonicalAccountNumber: string | null;
  destinationCanonicalAccountNumber: string | null;
  sendingRoutingNumberUsed: string;
  receivingRoutingNumberUsed: string;
  sourceResolverKey: string | null;
  destinationResolverKey: string | null;
  addressResolvedAt: Date;
};

function failAddressing(code: string): never {
  const sanitized = sanitizeAddressingFailureCode(code);
  throw new NccSettlementError(sanitized, sanitized);
}

/** Envelope-validate an optional public account identifier; preserve exact string. */
export function envelopeAccountIdentifier(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  const checked = validateNccAccountIdentifierEnvelope(value);
  if (!checked.ok) failAddressing(checked.code);
  return checked.value;
}

async function encryptAccountNumber(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await encryptSecret(value);
  } catch {
    // Encryption unavailable (misconfigured secrets) — still settle with masked snapshot only.
    return null;
  }
}

/**
 * Resolve public payment addresses through institution adapters before any NCC
 * ledger posting. NCC only envelope-validates identifiers; format/normalization
 * belongs to the institution identified by the routing number.
 */
export async function resolveSettlementPaymentAddresses(input: {
  sendingInstitution: { id: string; slug: string; isAlta: boolean };
  receivingInstitution: { id: string; slug: string; isAlta: boolean };
  sendingRoutingNumber: string;
  receivingRoutingNumber: string;
  currency: string;
  sourceAccountNumber?: string | null;
  destinationAccountNumber?: string | null;
}): Promise<ResolvedSettlementAddresses> {
  const currency = input.currency.toUpperCase();
  const sourceIdentifier = envelopeAccountIdentifier(input.sourceAccountNumber);
  const destinationIdentifier = envelopeAccountIdentifier(input.destinationAccountNumber);

  let sourceResolved: AdapterAccountResolution | null = null;
  let destinationResolved: AdapterAccountResolution | null = null;

  if (sourceIdentifier) {
    const sendAdapter = await getAdapterForInstitution(input.sendingInstitution);
    if (!sendAdapter) failAddressing(NCC_ADDRESSING_ERROR.SOURCE_ADAPTER_UNAVAILABLE);
    const result = await sendAdapter.resolveAccount({
      accountNumber: sourceIdentifier,
      currency,
      direction: "debit",
    });
    if (!result.ok) failAddressing(result.code);
    sourceResolved = result.account;
  }

  if (destinationIdentifier) {
    const recvAdapter = await getAdapterForInstitution(input.receivingInstitution);
    if (!recvAdapter) failAddressing(NCC_ADDRESSING_ERROR.DESTINATION_ADAPTER_UNAVAILABLE);
    const result = await recvAdapter.resolveAccount({
      accountNumber: destinationIdentifier,
      currency,
      direction: "credit",
    });
    if (!result.ok) failAddressing(result.code);
    destinationResolved = result.account;
  }

  const addressResolvedAt = new Date();
  const [sourceEnc, destEnc] = await Promise.all([
    encryptAccountNumber(sourceResolved?.canonicalAccountNumber ?? null),
    encryptAccountNumber(destinationResolved?.canonicalAccountNumber ?? null),
  ]);

  return {
    sourceInternalReference: sourceResolved?.internalAccountReference ?? null,
    destinationInternalReference: destinationResolved?.internalAccountReference ?? null,
    sourceAccountNumberMasked: sourceResolved?.maskedAccountNumber ?? null,
    destinationAccountNumberMasked: destinationResolved?.maskedAccountNumber ?? null,
    sourceAccountNumberEncrypted: sourceEnc,
    destinationAccountNumberEncrypted: destEnc,
    sourceCanonicalAccountNumber: sourceResolved?.canonicalAccountNumber ?? null,
    destinationCanonicalAccountNumber: destinationResolved?.canonicalAccountNumber ?? null,
    sendingRoutingNumberUsed: input.sendingRoutingNumber,
    receivingRoutingNumberUsed: input.receivingRoutingNumber,
    sourceResolverKey: sourceResolved?.resolverKey ?? null,
    destinationResolverKey: destinationResolved?.resolverKey ?? null,
    addressResolvedAt,
  };
}

export function publicAddressingErrorMessage(code: string): string {
  return addressingErrorMessage(sanitizeAddressingFailureCode(code));
}
