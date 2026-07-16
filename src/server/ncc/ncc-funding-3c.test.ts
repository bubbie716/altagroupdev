import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  customerFundingErrorMessage,
  customerFundingStatusLabel,
  getCustomerTerminalFundingRequest,
  listCustomerTerminalFundingHistory,
  listPersonalFundingSourceAccounts,
  NccFundingError,
  submitCustomerTerminalFunding,
  submitTerminalFundingRequest,
} from "@/server/ncc/ncc-funding.service";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import { ensureUserTerminalCashAccount } from "@/server/ncc/terminal-cash.service";
import { asDecimal } from "@/lib/ncc/ncc-money";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc sprint 3c bank website funding", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let userId = "";
  let otherUserId = "";
  let bankAccountId = "";
  let companyBankAccountId = "";
  let restrictedBankAccountId = "";
  let otherBankAccountId = "";
  let companyId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-3c-${suffix}`,
        discordUsername: `ncc_3c_${suffix}`,
      },
    });
    userId = user.id;

    const other = await prisma.user.create({
      data: {
        discordId: `ncc-3c-o-${suffix}`,
        discordUsername: `ncc_3c_o_${suffix}`,
      },
    });
    otherUserId = other.id;

    const company = await prisma.company.create({
      data: {
        name: `NCC 3C Co ${suffix}`,
        type: "PRIVATE_COMPANY",
      },
    });
    companyId = company.id;

    await prisma.companyMembership.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
      },
    });

    const personal = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `NCC 3C Personal ${suffix}`,
        accountNumber: `3C${suffix}`.slice(0, 16).padEnd(16, "0"),
        status: "ACTIVE",
        balance: new Prisma.Decimal(2_500),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    bankAccountId = personal.id;

    const companyAccount = await prisma.bankAccount.create({
      data: {
        userId,
        companyId,
        ownershipType: "COMPANY",
        accountType: "BUSINESS_OPERATING",
        accountName: `NCC 3C Co Op ${suffix}`,
        accountNumber: `3B${suffix}`.slice(0, 16).padEnd(16, "1"),
        status: "ACTIVE",
        balance: new Prisma.Decimal(8_000),
        currency: "FLR",
      },
    });
    companyBankAccountId = companyAccount.id;

    const restricted = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `NCC 3C Restricted ${suffix}`,
        accountNumber: `3R${suffix}`.slice(0, 16).padEnd(16, "2"),
        status: "ACTIVE",
        balance: new Prisma.Decimal(500),
        currency: "FLR",
        restrictWithdrawals: true,
        ownershipType: "PERSONAL",
      },
    });
    restrictedBankAccountId = restricted.id;

    const otherBank = await prisma.bankAccount.create({
      data: {
        userId: otherUserId,
        accountType: "CHECKING",
        accountName: `NCC 3C Other ${suffix}`,
        accountNumber: `3O${suffix}`.slice(0, 16).padEnd(16, "3"),
        status: "ACTIVE",
        balance: new Prisma.Decimal(1_000),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    otherBankAccountId = otherBank.id;
  });

  after(async () => {
    const funding = await prisma.terminalFundingRequest.findMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
      select: { id: true, settlementInstructionId: true },
    });
    const instructionIds = funding
      .map((row) => row.settlementInstructionId)
      .filter((id): id is string => !!id);

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
    await prisma.terminalCashEntry.deleteMany({
      where: { account: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } } },
    });
    await prisma.bankAccountHold.deleteMany({
      where: {
        bankAccountId: {
          in: [bankAccountId, companyBankAccountId, restrictedBankAccountId, otherBankAccountId].filter(
            Boolean,
          ),
        },
      },
    });
    await prisma.bankTransaction.deleteMany({
      where: {
        bankAccountId: {
          in: [bankAccountId, companyBankAccountId, restrictedBankAccountId, otherBankAccountId].filter(
            Boolean,
          ),
        },
      },
    });
    if (instructionIds.length > 0) {
      await prisma.settlementInstruction.deleteMany({ where: { id: { in: instructionIds } } });
    }
    await prisma.terminalCashAccount.deleteMany({
      where: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    for (const id of [bankAccountId, companyBankAccountId, restrictedBankAccountId, otherBankAccountId]) {
      if (id) await prisma.bankAccount.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.companyMembership.deleteMany({ where: { companyId } }).catch(() => undefined);
    if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
  });

  it("funds personal Terminal from personal Bank with friendly Bank debit and Terminal credit", async () => {
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeCash = asDecimal(cash.availableBalance);

    const view = await submitCustomerTerminalFunding(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "1.00",
      idempotencyKey: `3c-happy-${suffix}`,
      memo: "Sprint 3C check",
    });

    assert.equal(view.status, "COMPLETED");
    assert.equal(view.statusLabel, "Completed");
    assert.equal(view.destinationLabel, "My Alta Terminal account");
    assert.ok(view.publicReference);
    assert.equal(view.amount, "1.00");
    assert.ok(view.bankAvailableBalance);
    assert.ok(view.terminalAvailableBalance);

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(Number(asDecimal(beforeBank.balance).sub(asDecimal(afterBank.balance))), 1);
    assert.equal(Number(asDecimal(afterCash.availableBalance).sub(beforeCash)), 1);

    const request = await prisma.terminalFundingRequest.findUniqueOrThrow({
      where: { id: view.requestId },
    });
    assert.ok(request.settlementInstructionId);
    const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: request.settlementInstructionId! },
    });
    assert.equal(instruction.status, "SETTLED");
    assert.ok(instruction.settledAt);
    const metadata = (instruction.metadata ?? {}) as Record<string, unknown>;
    assert.equal(metadata.channel, "bank_website");
    assert.ok(!("batchId" in metadata) && !("clearingBatchId" in metadata));

    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(execution.status, "COMPLETED");
    // Immediate individual settlement — not queued for delayed/batch clearing.
    assert.ok(!["QUEUED", "BATCHED", "SCHEDULED"].includes(execution.status));

    const bankTx = await prisma.bankTransaction.findFirst({
      where: {
        bankAccountId,
        description: { contains: "Transfer to Alta Terminal" },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(bankTx);
    assert.match(bankTx!.description ?? "", /Transfer to Alta Terminal/);
    assert.match(bankTx!.description ?? "", new RegExp(view.publicReference!));

    const termEntry = await prisma.terminalCashEntry.findFirst({
      where: { settlementInstructionId: instruction.id },
    });
    assert.ok(termEntry);
    assert.equal(Number(asDecimal(termEntry!.amount)), 1);
  });

  it("rejects company Bank account funding personal Terminal cash", async () => {
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: companyBankAccountId },
    });
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeCash = asDecimal(cash.availableBalance);

    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: companyBankAccountId,
          amount: "5.00",
          idempotencyKey: `3c-company-${suffix}`,
        }),
      (err: unknown) => err instanceof NccFundingError && err.code === "COMPANY_SOURCE_NOT_SUPPORTED",
    );

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: companyBankAccountId },
    });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(asDecimal(afterBank.balance).toFixed(2), asDecimal(beforeBank.balance).toFixed(2));
    assert.equal(asDecimal(afterCash.availableBalance).toFixed(2), beforeCash.toFixed(2));
    assert.match(customerFundingErrorMessage("COMPANY_SOURCE_NOT_SUPPORTED"), /Business Bank accounts/i);
  });

  it("filters company accounts from personal funding source selector", async () => {
    const sources = await listPersonalFundingSourceAccounts(userId);
    assert.ok(sources.every((account) => !account.isCompanyAccount && !account.companyId));
    assert.ok(sources.some((account) => account.id === bankAccountId));
    assert.ok(!sources.some((account) => account.id === companyBankAccountId));
    assert.ok(!sources.some((account) => account.id === restrictedBankAccountId));
  });

  it("rejects same idempotency key with changed amount", async () => {
    const key = `3c-conflict-${suffix}`;
    await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "2.00",
      idempotencyKey: key,
    });
    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: bankAccountId,
          amount: "3.00",
          idempotencyKey: key,
        }),
      (err: unknown) => err instanceof NccFundingError && err.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  it("duplicate submission produces no additional debit or credit", async () => {
    const key = `3c-dup-${suffix}`;
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const beforeCash = asDecimal(cash.availableBalance);

    const first = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "4.00",
      idempotencyKey: key,
    });
    const midBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const midCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });

    const second = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "4.00",
      idempotencyKey: key,
    });
    assert.equal(first.id, second.id);

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(asDecimal(afterBank.balance).toFixed(2), asDecimal(midBank.balance).toFixed(2));
    assert.equal(
      asDecimal(afterCash.availableBalance).toFixed(2),
      asDecimal(midCash.availableBalance).toFixed(2),
    );
    assert.equal(Number(asDecimal(beforeBank.balance).sub(asDecimal(afterBank.balance))), 4);
    assert.equal(Number(asDecimal(afterCash.availableBalance).sub(beforeCash)), 4);
  });

  it("insufficient funds causes no ledger mutation", async () => {
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeCash = asDecimal(cash.availableBalance);
    const overBalance = asDecimal(beforeBank.balance).add(50).toFixed(2);

    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: bankAccountId,
          amount: overBalance,
          idempotencyKey: `3c-nsf-${suffix}`,
        }),
      (err: unknown) => err instanceof NccFundingError && err.code === "INSUFFICIENT_FUNDS",
    );

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(asDecimal(afterBank.balance).toFixed(2), asDecimal(beforeBank.balance).toFixed(2));
    assert.equal(asDecimal(afterCash.availableBalance).toFixed(2), beforeCash.toFixed(2));
  });

  it("rejects restricted source accounts", async () => {
    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: restrictedBankAccountId,
          amount: "1.00",
          idempotencyKey: `3c-restrict-${suffix}`,
        }),
      (err: unknown) => err instanceof NccFundingError && err.code === "SOURCE_ACCOUNT_RESTRICTED",
    );
  });

  it("rejects another user's Bank account", async () => {
    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: otherBankAccountId,
          amount: "1.00",
          idempotencyKey: `3c-other-${suffix}`,
        }),
      (err: unknown) =>
        err instanceof NccFundingError &&
        (err.code === "SOURCE_ACCOUNT_NOT_ACCESSIBLE" || err.code === "FORBIDDEN"),
    );
  });

  it("user cannot view another user's funding history or request", async () => {
    const own = await submitCustomerTerminalFunding(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "1.50",
      idempotencyKey: `3c-hist-${suffix}`,
    });
    const history = await listCustomerTerminalFundingHistory(otherUserId, 50);
    assert.ok(!history.some((row) => row.requestId === own.requestId));

    await assert.rejects(
      () => getCustomerTerminalFundingRequest(otherUserId, own.requestId),
      (err: unknown) => err instanceof NccFundingError && err.code === "NOT_FOUND",
    );
  });

  it("maps customer-facing statuses accurately", () => {
    assert.equal(customerFundingStatusLabel("COMPLETED"), "Completed");
    assert.equal(customerFundingStatusLabel("FAILED"), "Failed");
    assert.equal(customerFundingStatusLabel("REVERSED"), "Reversed");
    assert.equal(customerFundingStatusLabel("NCC_POSTED"), "Sent to NCC");
    assert.equal(customerFundingStatusLabel("PREPARING"), "Preparing");
    assert.equal(customerFundingStatusLabel("SOURCE_COMMITTED", "RETRY_PENDING"), "Delayed—still processing");
    assert.equal(customerFundingStatusLabel("SOURCE_COMMITTED", "MANUAL_REVIEW"), "Needs review");
  });
});
