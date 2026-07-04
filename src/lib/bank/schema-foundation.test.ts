import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_BANK_PRIMARY_ROUTING_NUMBER,
  isCompanyOwnedBankAccount,
  paymentTypeToTransferGroupType,
  resolveBankAccountOwnershipType,
} from "./account-ownership.ts";
import { buildLinkedReversalMetadata } from "../internal/transaction-reversal-link.ts";

describe("bank account ownership", () => {
  it("resolves PERSONAL when no company", () => {
    assert.equal(resolveBankAccountOwnershipType({ companyId: null }), "PERSONAL");
    assert.equal(isCompanyOwnedBankAccount({ companyId: null }), false);
  });

  it("resolves COMPANY when companyId is set", () => {
    assert.equal(
      resolveBankAccountOwnershipType({ companyId: "c1", ownershipType: "COMPANY" }),
      "COMPANY",
    );
    assert.equal(isCompanyOwnedBankAccount({ companyId: "c1", ownershipType: "COMPANY" }), true);
  });

  it("infers COMPANY from companyId when ownershipType missing (legacy)", () => {
    assert.equal(resolveBankAccountOwnershipType({ companyId: "c1" }), "COMPANY");
  });
});

describe("payment and transfer group types", () => {
  it("maps payment types to transfer group types", () => {
    assert.equal(paymentTypeToTransferGroupType("ALTA_PAY"), "ALTA_PAY");
    assert.equal(paymentTypeToTransferGroupType("INTRABANK_TRANSFER"), "INTRABANK_TRANSFER");
    assert.equal(paymentTypeToTransferGroupType("INTERBANK_TRANSFER"), "INTERBANK_TRANSFER");
  });
});

describe("Alta Bank institution constants", () => {
  it("uses stable institution and routing identifiers", () => {
    assert.equal(ALTA_BANK_INSTITUTION_ID, "inst-alta-bank");
    assert.equal(ALTA_BANK_PRIMARY_ROUTING_NUMBER, "011000001");
  });
});

describe("schema foundation services", () => {
  it("exports payment entity helpers", async () => {
    const mod = await import("../../server/payment-entity.service.ts");
    assert.equal(typeof mod.recordPairedPaymentInTx, "function");
    assert.equal(typeof mod.recordAdjustmentReversalGroupInTx, "function");
    assert.equal(typeof mod.findPaymentByReferenceCode, "function");
    assert.equal(typeof mod.findTransferGroupByReferenceCode, "function");
  });

  it("exports financial institution helpers", async () => {
    const mod = await import("../../server/financial-institution.service.ts");
    assert.equal(typeof mod.getAltaBankInstitution, "function");
    assert.equal(typeof mod.ensureAltaBankInstitutionSeeded, "function");
  });

  it("exports relationship and assignment helpers", async () => {
    const mod = await import("../../server/relationship-assignment.service.ts");
    assert.equal(typeof mod.assignPrivateBanker, "function");
    assert.equal(typeof mod.createStaffAssignment, "function");
    assert.equal(typeof mod.createDocumentRecord, "function");
  });
});

describe("transfer group reversal metadata", () => {
  it("links adjustment reversals for grouped ledger entries", () => {
    const meta = buildLinkedReversalMetadata({
      originalTransactionId: "tx-1",
      originalReferenceCode: "ADJ-1",
      reversalTransactionId: "tx-2",
      reversalReferenceCode: "ADJ-2",
      reversalReason: "Correction",
      reversedByUserId: "staff-1",
      reversalKind: "adjustment",
    });
    assert.equal(meta.originalReferenceCode, "ADJ-1");
    assert.equal(meta.reversalReferenceCode, "ADJ-2");
  });
});

describe("backwards compatibility", () => {
  it("bank service still exports core account APIs", async () => {
    const mod = await import("../../server/bank.service.ts");
    assert.equal(typeof mod.submitInternalTransfer, "function");
    assert.equal(typeof mod.openBankAccount, "function");
    assert.equal(typeof mod.listUserBankAccounts, "function");
  });

  it("alta pay service still exports submit API", async () => {
    const mod = await import("../../server/alta-pay.service.ts");
    assert.equal(typeof mod.submitAltaPayPayment, "function");
  });

  it("bank account access still resolves membership-based access", async () => {
    const mod = await import("../../server/bank-account-access.service.ts");
    assert.equal(typeof mod.bankAccountAccessWhere, "function");
    assert.equal(typeof mod.isBankAccountAccessibleByUser, "function");
  });
});
