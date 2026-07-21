import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  generateTerminalAccountNumber,
  isValidTerminalAccountNumber,
  maskAccountIdentifierForDisplay,
  validateNccAccountIdentifierEnvelope,
} from "@/lib/ncc/ncc-account-number";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import type {
  AdapterCommitResult,
  AdapterCreditResult,
  AdapterPreparationResult,
  AdapterResolveResult,
  AdapterValidationResult,
  InstitutionAdapter,
} from "@/server/ncc/institution-adapter";
import {
  getAdapterForInstitution,
  registerInstitutionAdapter,
} from "@/server/ncc/institution-adapter.registry";
import { AltaBankInstitutionAdapter } from "@/server/ncc/adapters/alta-bank.adapter";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import { NccSettlementError, submitInstruction } from "@/server/ncc/ncc-settlement.service";
import { submitTerminalFundingRequest } from "@/server/ncc/ncc-funding.service";
import { ensureUserTerminalCashAccount } from "@/server/ncc/terminal-cash.service";
import { ALTA_BANK_INSTITUTION_ID } from "@/lib/bank/account-ownership";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

/** Test-only external adapter: case-sensitive, punctuation-preserving identifiers. */
function createExternalFixtureAdapter(
  key: string,
  directory: Map<string, { internalId: string; currency: string }>,
): InstitutionAdapter {
  const float = async (): Promise<AdapterPreparationResult> => ({
    ok: true,
    holdReference: `fixture-hold:${key}`,
  });
  const commit = async (): Promise<AdapterCommitResult> => ({
    ok: true,
    externalReference: `fixture-commit:${key}`,
  });
  const credit = async (): Promise<AdapterCreditResult> => ({
    ok: true,
    credited: true,
    externalReference: `fixture-credit:${key}`,
  });

  return {
    institutionKey: key,
    async resolveAccount(input): Promise<AdapterResolveResult> {
      // Institution-specific: exact string match — no case fold, no strip.
      const entry = directory.get(input.accountNumber);
      if (!entry || entry.currency !== input.currency.toUpperCase()) {
        return { ok: false, code: "ACCOUNT_UNAVAILABLE", reason: "Account unavailable" };
      }
      return {
        ok: true,
        account: {
          internalAccountReference: entry.internalId,
          canonicalAccountNumber: input.accountNumber,
          maskedAccountNumber: maskAccountIdentifierForDisplay(input.accountNumber),
          currency: entry.currency,
          status: "ACTIVE",
          debitEligible: true,
          creditEligible: true,
          beneficiaryLabel: null,
          resolvedAt: new Date().toISOString(),
          resolverKey: `${key}@1`,
        },
      };
    },
    async validateAccountReference(input): Promise<AdapterValidationResult> {
      for (const [ident, entry] of directory) {
        if (entry.internalId === input.accountReference) {
          return { ok: true, accountReference: entry.internalId };
        }
        void ident;
      }
      return { ok: false, code: "INVALID_ACCOUNT_REF", reason: "Unknown" };
    },
    prepareDebit: float,
    commitDebit: commit,
    releaseDebit: async () => undefined,
    compensateDebit: commit,
    notifyCredit: credit,
  };
}

describe("ncc sprint 4a correction — institution-specific identifier formats", {
  skip: !RUN || !isDatabaseConfigured(),
}, () => {
  const suffix = Date.now().toString(36);
  const extAKey = `ext-a-${suffix}`;
  const extBKey = `ext-b-${suffix}`;
  let userId = "";
  let bankAccountId = "";
  let bankAccountNumber = "";
  let terminalAccountNumberBefore = "";
  let terminalBalanceBefore = "";
  let extAInstitutionId = "";
  let extBInstitutionId = "";
  let extARoutingId = "";
  let extBRoutingId = "";
  let extARoutingNumber = "";
  let extBRoutingNumber = "";
  let bankRoutingId = "";
  let seenIdentifiers: string[] = [];

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-4af-${suffix}`,
        discordUsername: `ncc_4af_${suffix}`,
      },
    });
    userId = user.id;

    const bank = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `4AF ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + (Number.parseInt(suffix.slice(-5), 36) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(5_000),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    bankAccountId = bank.id;
    bankAccountNumber = bank.accountNumber;

    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    terminalAccountNumberBefore = cash.accountNumber;
    terminalBalanceBefore = asDecimal(cash.availableBalance).toFixed(2);

    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    bankRoutingId = bankRouting.id;

    const extA = await prisma.financialInstitution.create({
      data: {
        legalName: `Ext A ${suffix}`,
        displayName: `Ext A ${suffix}`,
        slug: extAKey,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    extAInstitutionId = extA.id;
    extARoutingNumber = `81${randomBytes(4).toString("hex")}`.replace(/[^0-9]/g, "").padEnd(9, "1").slice(0, 9);
    const rnA = await prisma.routingNumber.create({
      data: {
        routingNumber: extARoutingNumber,
        institutionId: extAInstitutionId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    extARoutingId = rnA.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: extAInstitutionId,
        currency: "FLR",
        ledgerBalance: new Prisma.Decimal(1_000_000),
        availableBalance: new Prisma.Decimal(1_000_000),
        status: "ACTIVE",
      },
    });

    const extB = await prisma.financialInstitution.create({
      data: {
        legalName: `Ext B ${suffix}`,
        displayName: `Ext B ${suffix}`,
        slug: extBKey,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    extBInstitutionId = extB.id;
    extBRoutingNumber = `72${randomBytes(4).toString("hex")}`.replace(/[^0-9]/g, "").padEnd(9, "2").slice(0, 9);
    const rnB = await prisma.routingNumber.create({
      data: {
        routingNumber: extBRoutingNumber,
        institutionId: extBInstitutionId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    extBRoutingId = rnB.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: extBInstitutionId,
        currency: "FLR",
        ledgerBalance: new Prisma.Decimal(1_000_000),
        availableBalance: new Prisma.Decimal(1_000_000),
        status: "ACTIVE",
      },
    });

    // Same customer-visible identifier string at two different institutions.
    const sharedIdent = "0001847291";
    const dirA = new Map([
      [sharedIdent, { internalId: `int-a-${suffix}`, currency: "FLR" }],
      ["AB-4928-17-X", { internalId: `int-a-alnum-${suffix}`, currency: "FLR" }],
      ["BR05/839201", { internalId: `int-a-punct-${suffix}`, currency: "FLR" }],
    ]);
    const dirB = new Map([
      [sharedIdent, { internalId: `int-b-${suffix}`, currency: "FLR" }],
    ]);

    const adapterA = createExternalFixtureAdapter(extAKey, dirA);
    const adapterB = createExternalFixtureAdapter(extBKey, dirB);
    const originalResolveA = adapterA.resolveAccount.bind(adapterA);
    adapterA.resolveAccount = async (input) => {
      seenIdentifiers.push(input.accountNumber);
      return originalResolveA(input);
    };

    registerInstitutionAdapter(adapterA);
    registerInstitutionAdapter(adapterB);
  });

  it("envelope validation is format-neutral and preserves opaque strings", () => {
    assert.deepEqual(validateNccAccountIdentifierEnvelope("0001847291"), {
      ok: true,
      value: "0001847291",
    });
    assert.deepEqual(validateNccAccountIdentifierEnvelope("AB-4928-17-X"), {
      ok: true,
      value: "AB-4928-17-X",
    });
    assert.deepEqual(validateNccAccountIdentifierEnvelope("ab-4928-17-x"), {
      ok: true,
      value: "ab-4928-17-x",
    });
    assert.deepEqual(validateNccAccountIdentifierEnvelope("BR05/839201"), {
      ok: true,
      value: "BR05/839201",
    });
    // Must not uppercase / strip punctuation globally.
    const punct = validateNccAccountIdentifierEnvelope("BR05/839201");
    assert.ok(punct.ok);
    assert.equal(punct.value, "BR05/839201");
    assert.notEqual(punct.value, punct.value.toLowerCase());

    assert.equal(validateNccAccountIdentifierEnvelope(" 0001847291").ok, false);
    assert.equal(validateNccAccountIdentifierEnvelope("0001847291 ").ok, false);
    assert.equal(validateNccAccountIdentifierEnvelope("").ok, false);
    assert.equal(validateNccAccountIdentifierEnvelope("a".repeat(65)).ok, false);
    assert.equal(validateNccAccountIdentifierEnvelope("bad\u0000id").ok, false);
    assert.equal(validateNccAccountIdentifierEnvelope("bad\nid").ok, false);

    // Never parse as number — leading zeros would be lost.
    const zeros = "0001847291";
    assert.notEqual(zeros, String(Number(zeros)));
    const env = validateNccAccountIdentifierEnvelope(zeros);
    assert.ok(env.ok);
    assert.equal(env.value, zeros);
  });

  it("digits-only Alta Bank identifier resolves via Bank adapter", async () => {
    const adapter = new AltaBankInstitutionAdapter();
    const result = await adapter.resolveAccount({
      accountNumber: bankAccountNumber,
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.account.internalAccountReference, bankAccountId);
      assert.equal(result.account.canonicalAccountNumber, bankAccountNumber);
    }
  });

  it("alphanumeric and punctuated identifiers reach the owning adapter unchanged", async () => {
    seenIdentifiers = [];
    const instA = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: extAInstitutionId },
    });
    const adapter = await getAdapterForInstitution(instA);
    assert.ok(adapter);

    for (const ident of ["AB-4928-17-X", "BR05/839201", "0001847291"] as const) {
      const result = await adapter!.resolveAccount({
        accountNumber: ident,
        currency: "FLR",
        direction: "credit",
      });
      assert.equal(result.ok, true, ident);
      if (result.ok) {
        assert.equal(result.account.canonicalAccountNumber, ident);
      }
    }
    assert.deepEqual(seenIdentifiers, ["AB-4928-17-X", "BR05/839201", "0001847291"]);
  });

  it("same account identifier may exist under two routing numbers / adapters", async () => {
    const shared = "0001847291";
    const instA = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: extAInstitutionId },
    });
    const instB = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: extBInstitutionId },
    });
    const adapterA = await getAdapterForInstitution(instA);
    const adapterB = await getAdapterForInstitution(instB);
    const a = await adapterA!.resolveAccount({
      accountNumber: shared,
      currency: "FLR",
      direction: "credit",
    });
    const b = await adapterB!.resolveAccount({
      accountNumber: shared,
      currency: "FLR",
      direction: "credit",
    });
    assert.ok(a.ok && b.ok);
    if (a.ok && b.ok) {
      assert.notEqual(a.account.internalAccountReference, b.account.internalAccountReference);
      assert.equal(a.account.canonicalAccountNumber, shared);
      assert.equal(b.account.canonicalAccountNumber, shared);
    }
  });

  it("institution-specific normalization is not applied by NCC envelope", async () => {
    // Lowercase AB- form is preserved by envelope; Bank adapter may normalize.
    const env = validateNccAccountIdentifierEnvelope("ab-2000-482913");
    assert.ok(env.ok);
    assert.equal(env.value, "ab-2000-482913");

    const bankAdapter = new AltaBankInstitutionAdapter();
    const bankResult = await bankAdapter.resolveAccount({
      accountNumber: bankAccountNumber.toLowerCase(),
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(bankResult.ok, true);

    // External fixture is case-sensitive — lowercase must not resolve.
    const instA = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: extAInstitutionId },
    });
    const extAdapter = await getAdapterForInstitution(instA);
    const ext = await extAdapter!.resolveAccount({
      accountNumber: "ab-4928-17-x",
      currency: "FLR",
      direction: "credit",
    });
    assert.equal(ext.ok, false);
  });

  it("settlement preserves destination identifier in idempotency and rejects changes", async () => {
    const key = `4af-idemp-${suffix}`;
    const first = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: extAInstitutionId,
      sendingRoutingNumberId: bankRoutingId,
      receivingRoutingNumberId: extARoutingId,
      amount: 1,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: key,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: "0001847291",
    });
    assert.ok(first.id);

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: extAInstitutionId,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: extARoutingId,
          amount: 1,
          currency: NCC_DEFAULT_CURRENCY,
          idempotencyKey: key,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: "AB-4928-17-X",
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  it("control characters and oversized identifiers are rejected before resolve", async () => {
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: extAInstitutionId,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: extARoutingId,
          amount: 1,
          currency: NCC_DEFAULT_CURRENCY,
          idempotencyKey: `4af-ctrl-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: "bad\u0000id",
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "INVALID_PAYMENT_ADDRESS",
    );

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: extAInstitutionId,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: extARoutingId,
          amount: 1,
          currency: NCC_DEFAULT_CURRENCY,
          idempotencyKey: `4af-long-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: "x".repeat(65),
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "INVALID_PAYMENT_ADDRESS",
    );
  });

  it("internal database IDs remain unavailable as payment addresses", async () => {
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: extAInstitutionId,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: extARoutingId,
          amount: 1,
          currency: NCC_DEFAULT_CURRENCY,
          idempotencyKey: `4af-cuid-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountId,
          destinationAccountNumber: "0001847291",
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "INVALID_PAYMENT_ADDRESS",
    );
  });

  it("Bank → Terminal instant settlement still works; Terminal numbers/balances unchanged by correction", async () => {
    const beforeCash = await ensureUserTerminalCashAccount(userId, "FLR");
    assert.equal(beforeCash.accountNumber, terminalAccountNumberBefore);

    const funded = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "2.00",
      idempotencyKey: `4af-fund-${suffix}`,
    });
    assert.equal(funded.status, "COMPLETED");

    const afterCash = await ensureUserTerminalCashAccount(userId, "FLR");
    assert.equal(afterCash.accountNumber, terminalAccountNumberBefore);
    assert.ok(isValidTerminalAccountNumber(afterCash.accountNumber));
    assert.equal(
      asDecimal(afterCash.availableBalance).toFixed(2),
      asDecimal(terminalBalanceBefore).add(2).toFixed(2),
    );

    // Generator still returns strings (may include leading zeros); never Number().
    const generated = generateTerminalAccountNumber();
    assert.equal(typeof generated, "string");
    assert.equal(generated.length, 12);
    assert.ok(/^\d{12}$/.test(generated));
  });

  it("unknown external identifier yields sanitized non-enumerating error", async () => {
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: extAInstitutionId,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: extARoutingId,
          amount: 1,
          currency: NCC_DEFAULT_CURRENCY,
          idempotencyKey: `4af-unk-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: "DOES-NOT-EXIST-99",
        }),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "ACCOUNT_UNAVAILABLE",
    );
  });

  it("two different routing numbers resolve through respective adapters", async () => {
    assert.notEqual(extARoutingNumber, extBRoutingNumber);
    const shared = "0001847291";
    const toA = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: extAInstitutionId,
      sendingRoutingNumberId: bankRoutingId,
      receivingRoutingNumberId: extARoutingId,
      amount: 1,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `4af-route-a-${suffix}`,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: shared,
    });
    const toB = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: extBInstitutionId,
      sendingRoutingNumberId: bankRoutingId,
      receivingRoutingNumberId: extBRoutingId,
      amount: 1,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `4af-route-b-${suffix}`,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: shared,
    });
    assert.notEqual(toA.id, toB.id);
    assert.equal(toA.receivingInstitutionId, extAInstitutionId);
    assert.equal(toB.receivingInstitutionId, extBInstitutionId);
  });
});
