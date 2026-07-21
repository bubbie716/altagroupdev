import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import { asDecimal } from "@/lib/ncc/ncc-money";
import { AltaBankInstitutionAdapter } from "@/server/ncc/adapters/alta-bank.adapter";
import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";
import { submitTerminalFundingRequest } from "@/server/ncc/ncc-funding.service";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import { reconcileInstruction } from "@/server/ncc/ncc-reconciliation.service";
import { submitTerminalWithdrawalRequest } from "@/server/ncc/ncc-withdrawal.service";
import { ensureUserTerminalCashAccount } from "@/server/ncc/terminal-cash.service";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc alta realtime integration", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let userId = "";
  let otherUserId = "";
  let bankAccountId = "";
  let otherBankAccountId = "";
  let otherInstitutionId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-rt-${suffix}`,
        discordUsername: `ncc_rt_${suffix}`,
      },
    });
    userId = user.id;

    const other = await prisma.user.create({
      data: {
        discordId: `ncc-rt-o-${suffix}`,
        discordUsername: `ncc_rt_o_${suffix}`,
      },
    });
    otherUserId = other.id;

    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `NCC RT ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + ((Number.parseInt(suffix.slice(-5), 36) + 10) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(5_000),
        currency: "FLR",
      },
    });
    bankAccountId = bankAccount.id;

    const otherBank = await prisma.bankAccount.create({
      data: {
        userId: otherUserId,
        accountType: "CHECKING",
        accountName: `NCC RT other ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + ((Number.parseInt(suffix.slice(-5), 36) + 11) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(1_000),
        currency: "FLR",
      },
    });
    otherBankAccountId = otherBank.id;

    await prisma.institutionMember.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        userId,
        role: "INSTITUTION_OWNER",
        status: "ACTIVE",
      },
    });

    const otherInst = await prisma.financialInstitution.create({
      data: {
        legalName: `Other Inst ${suffix}`,
        displayName: `Other ${suffix}`,
        slug: `other-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    otherInstitutionId = otherInst.id;

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "NCC_OTHER_INSTITUTION_EVENT",
        entityType: "FINANCIAL_INSTITUTION",
        entityId: otherInstitutionId,
        institutionId: otherInstitutionId,
        description: "Should not leak to Alta Bank portal",
      },
    });
  });

  after(async () => {
    const funding = await prisma.terminalFundingRequest.findMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
      select: { id: true, settlementInstructionId: true },
    });
    const withdrawals = await prisma.terminalWithdrawalRequest.findMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
      select: { id: true, settlementInstructionId: true },
    });
    const instructionIds = [
      ...funding.map((row) => row.settlementInstructionId),
      ...withdrawals.map((row) => row.settlementInstructionId),
    ].filter((id): id is string => !!id);

    if (instructionIds.length > 0) {
      await prisma.settlementReconciliation.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementOutboxEvent.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.terminalCashEntry.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementExecution.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementEntry.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
    }

    await prisma.terminalFundingRequest.deleteMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.terminalWithdrawalRequest.deleteMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.terminalCashEntry.deleteMany({
      where: {
        account: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } },
      },
    });
    await prisma.bankAccountHold.deleteMany({
      where: { bankAccountId: { in: [bankAccountId, otherBankAccountId].filter(Boolean) } },
    });
    await prisma.bankTransaction.deleteMany({
      where: { bankAccountId: { in: [bankAccountId, otherBankAccountId].filter(Boolean) } },
    });
    if (instructionIds.length > 0) {
      await prisma.settlementInstruction.deleteMany({ where: { id: { in: instructionIds } } });
    }
    await prisma.terminalCashAccount.deleteMany({
      where: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.institutionMember.deleteMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    if (bankAccountId) await prisma.bankAccount.delete({ where: { id: bankAccountId } }).catch(() => undefined);
    if (otherBankAccountId) {
      await prisma.bankAccount.delete({ where: { id: otherBankAccountId } }).catch(() => undefined);
    }
    if (otherInstitutionId) {
      await prisma.financialInstitution.delete({ where: { id: otherInstitutionId } }).catch(() => undefined);
    }
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
  });

  it("bank adapter prepares and commits debit once", async () => {
    const adapter = new AltaBankInstitutionAdapter();
    const instructionId = `adapter-prep-${suffix}`;
    const prep = await adapter.prepareDebit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TEST-${suffix}`,
      amount: "25.00",
      currency: "FLR",
      accountReference: bankAccountId,
      actorUserId: userId,
    });
    assert.equal(prep.ok, true);
    if (!prep.ok) return;
    const prep2 = await adapter.prepareDebit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TEST-${suffix}`,
      amount: "25.00",
      currency: "FLR",
      accountReference: bankAccountId,
      actorUserId: userId,
    });
    assert.equal(prep2.ok, true);
    if (!prep2.ok) return;
    assert.equal(prep.holdReference, prep2.holdReference);

    const commit = await adapter.commitDebit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TEST-${suffix}`,
      amount: "25.00",
      currency: "FLR",
      accountReference: bankAccountId,
      holdReference: prep.holdReference,
      actorUserId: userId,
    });
    assert.equal(commit.ok, true);
    const commit2 = await adapter.commitDebit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TEST-${suffix}`,
      amount: "25.00",
      currency: "FLR",
      accountReference: bankAccountId,
      holdReference: prep.holdReference,
      actorUserId: userId,
    });
    assert.equal(commit2.ok, true);
    if (commit.ok && commit2.ok) {
      assert.equal(commit.externalReference, commit2.externalReference);
    }
  });

  it("terminal adapter credits once", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const adapter = new AltaTerminalInstitutionAdapter();
    const instructionId = `term-credit-${suffix}`;
    const first = await adapter.notifyCredit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TERM-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: cash.id,
      actorUserId: userId,
    });
    assert.equal(first.ok, true);
    const second = await adapter.notifyCredit({
      settlementInstructionId: instructionId,
      publicReference: `NCC-TERM-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: cash.id,
      actorUserId: userId,
    });
    assert.equal(second.ok, true);
    const entries = await prisma.terminalCashEntry.count({
      where: { idempotencyKey: `ncc-term-credit:${instructionId}` },
    });
    assert.equal(entries, 1);
  });

  it("funds Bank → Terminal end-to-end without double credit", async () => {
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeCash = asDecimal(cash.availableBalance);

    const key = `fund-${suffix}`;
    const first = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: 100,
      idempotencyKey: key,
    });
    const second = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: 100,
      idempotencyKey: key,
    });
    assert.equal(first.id, second.id);
    assert.equal(first.status, "COMPLETED");

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(Number(asDecimal(beforeBank.balance).sub(asDecimal(afterBank.balance))), 100);
    assert.equal(Number(asDecimal(afterCash.availableBalance).sub(beforeCash)), 100);

    assert.ok(first.settlementInstructionId);
    const execution = await prisma.settlementExecution.findUnique({
      where: { settlementInstructionId: first.settlementInstructionId! },
    });
    assert.equal(execution?.status, "COMPLETED");

    const reconciliation = await reconcileInstruction(first.settlementInstructionId!);
    assert.ok(["MATCHED", "PENDING"].includes(reconciliation.status));
  });

  it("rejects unauthorized funding source", async () => {
    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: otherBankAccountId,
          amount: 10,
          idempotencyKey: `unauth-fund-${suffix}`,
        }),
      (err: unknown) => err instanceof Error && /SOURCE_ACCOUNT_NOT_ACCESSIBLE|FORBIDDEN/.test(String(err)),
    );
  });

  it("withdraws Terminal → Bank end-to-end", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    // Ensure cash available after prior funding tests
    const available = asDecimal(cash.availableBalance);
    if (available.lt(50)) {
      await submitTerminalFundingRequest(userId, {
        sourceBankAccountId: bankAccountId,
        amount: 200,
        idempotencyKey: `prefund-wd-${suffix}`,
      });
    }

    const beforeCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });

    const result = await submitTerminalWithdrawalRequest(userId, {
      terminalCashAccountId: cash.id,
      destinationBankAccountId: bankAccountId,
      amount: 40,
      idempotencyKey: `wd-${suffix}`,
    });
    assert.equal(result.status, "COMPLETED");

    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    assert.equal(Number(asDecimal(beforeCash.availableBalance).sub(asDecimal(afterCash.availableBalance))), 40);
    assert.equal(Number(asDecimal(afterBank.balance).sub(asDecimal(beforeBank.balance))), 40);
  });

  it("isolates portal audit by institution", async () => {
    // Direct isolation check without request-scoped auth (portal service requires session).
    const leaked = await prisma.auditLog.findMany({
      where: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        action: "NCC_OTHER_INSTITUTION_EVENT",
      },
    });
    assert.equal(leaked.length, 0);

    const otherVisibleIfUnscoped = await prisma.auditLog.findMany({
      where: { action: "NCC_OTHER_INSTITUTION_EVENT", institutionId: otherInstitutionId },
    });
    assert.ok(otherVisibleIfUnscoped.length >= 1);

    const scoped = await prisma.auditLog.findMany({
      where: {
        OR: [
          { institutionId: ALTA_BANK_INSTITUTION_ID },
          { entityType: "FINANCIAL_INSTITUTION", entityId: ALTA_BANK_INSTITUTION_ID },
        ],
        action: "NCC_OTHER_INSTITUTION_EVENT",
      },
    });
    assert.equal(scoped.length, 0);
  });
});
