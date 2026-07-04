import type {
  BankAccountOwnershipType,
  PaymentType,
  TransferGroupType,
} from "@prisma/client";

/** Maps bank account fields to canonical ownership semantics. */
export function resolveBankAccountOwnershipType(input: {
  ownershipType?: BankAccountOwnershipType | null;
  companyId?: string | null;
}): BankAccountOwnershipType {
  if (input.ownershipType) return input.ownershipType;
  return input.companyId ? "COMPANY" : "PERSONAL";
}

/** Company-owned accounts are accessed via membership — not solely via userId. */
export function isCompanyOwnedBankAccount(input: {
  ownershipType?: BankAccountOwnershipType | null;
  companyId?: string | null;
}): boolean {
  return resolveBankAccountOwnershipType(input) === "COMPANY" && !!input.companyId;
}

export function paymentTypeToTransferGroupType(paymentType: PaymentType): TransferGroupType {
  switch (paymentType) {
    case "ALTA_PAY":
      return "ALTA_PAY";
    case "INTRABANK_TRANSFER":
      return "INTRABANK_TRANSFER";
    case "INTERBANK_TRANSFER":
      return "INTERBANK_TRANSFER";
    default:
      return "OTHER";
  }
}

export const ALTA_BANK_INSTITUTION_ID = "inst-alta-bank";
export const ALTA_BANK_PRIMARY_ROUTING_NUMBER = "011000001";
