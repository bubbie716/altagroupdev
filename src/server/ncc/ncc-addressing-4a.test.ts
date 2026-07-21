import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import {
  generateTerminalAccountNumber,
  isLikelyInternalDatabaseId,
  isValidTerminalAccountNumber,
  maskPaymentAccountNumber,
} from "@/lib/ncc/ncc-account-number";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { AltaBankInstitutionAdapter } from "@/server/ncc/adapters/alta-bank.adapter";
import { AltaTerminalInstitutionAdapter } from "@/server/ncc/adapters/alta-terminal.adapter";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import { apiSubmitSettlement } from "@/server/ncc/ncc-api-settlement.service";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import {
  ensureUserTerminalCashAccount,
  getUserTerminalCashAccount,
} from "@/server/ncc/terminal-cash.service";
import { submitTerminalFundingRequest } from "@/server/ncc/ncc-funding.service";
import { submitTerminalWithdrawalRequest } from "@/server/ncc/ncc-withdrawal.service";
import { NccSettlementError, submitInstruction } from "@/server/ncc/ncc-settlement.service";
import { resolveFundingIdempotencyKey } from "@/lib/bank/ncc-terminal-funding-idempotency";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc sprint 4a account addressing", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let userId = "";
  let otherUserId = "";
  let bankAccountId = "";
  let bankAccountNumber = "";
  let otherBankAccountId = "";
  let otherBankAccountNumber = "";
  let frozenBankAccountNumber = "";
  let noAdapterSendId = "";
  let noAdapterSendRoutingId = "";
  let noAdapterRecvId = "";
  let noAdapterRecvRoutingId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: { discordId: `ncc-4a-${suffix}`, discordUsername: `ncc_4a_${suffix}` },
    });
    userId = user.id;
    const other = await prisma.user.create({
      data: { discordId: `ncc-4a-o-${suffix}`, discordUsername: `ncc_4a_o_${suffix}` },
    });
    otherUserId = other.id;

    const bank = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `NCC 4A ${suffix}`,
        accountNumber: `AB-2000-${String(Math.floor(100000 + Math.random() * 899999))}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(5_000),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    bankAccountId = bank.id;
    bankAccountNumber = bank.accountNumber;

    const otherBank = await prisma.bankAccount.create({
      data: {
        userId: otherUserId,
        accountType: "CHECKING",
        accountName: `NCC 4A other ${suffix}`,
        accountNumber: `AB-2000-${String(Math.floor(100000 + Math.random() * 899999))}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(1_000),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    otherBankAccountId = otherBank.id;
    otherBankAccountNumber = otherBank.accountNumber;

    const frozen = await prisma.bankAccount.create({
      data: {
        userId,
        accountType: "CHECKING",
        accountName: `NCC 4A frozen ${suffix}`,
        accountNumber: `AB-2000-${String(Math.floor(100000 + Math.random() * 899999))}`,
        status: "FROZEN",
        balance: new Prisma.Decimal(100),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    frozenBankAccountNumber = frozen.accountNumber;

    const sendInst = await prisma.financialInstitution.create({
      data: {
        legalName: `No Adapter Send 4A ${suffix}`,
        displayName: `NoAdapterSend4A ${suffix}`,
        slug: `no-adapter-send-4a-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    noAdapterSendId = sendInst.id;
    const sendRouting = await prisma.routingNumber.create({
      data: {
        routingNumber: `8${suffix}`.slice(0, 9).padEnd(9, "2"),
        institutionId: noAdapterSendId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    noAdapterSendRoutingId = sendRouting.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: noAdapterSendId,
        currency: "FLR",
        ledgerBalance: new Prisma.Decimal(100_000),
        availableBalance: new Prisma.Decimal(100_000),
        status: "ACTIVE",
      },
    });

    const recvInst = await prisma.financialInstitution.create({
      data: {
        legalName: `No Adapter Recv 4A ${suffix}`,
        displayName: `NoAdapterRecv4A ${suffix}`,
        slug: `no-adapter-recv-4a-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    noAdapterRecvId = recvInst.id;
    const recvRouting = await prisma.routingNumber.create({
      data: {
        routingNumber: `7${suffix}`.slice(0, 9).padEnd(9, "3"),
        institutionId: noAdapterRecvId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    noAdapterRecvRoutingId = recvRouting.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: noAdapterRecvId,
        currency: "FLR",
        ledgerBalance: new Prisma.Decimal(100_000),
        availableBalance: new Prisma.Decimal(100_000),
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    const funding = await prisma.terminalFundingRequest.findMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
      select: { settlementInstructionId: true },
    });
    const withdrawals = await prisma.terminalWithdrawalRequest.findMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
      select: { settlementInstructionId: true },
    });
    const instructionIds = [
      ...funding.map((r) => r.settlementInstructionId),
      ...withdrawals.map((r) => r.settlementInstructionId),
    ].filter((id): id is string => !!id);

    const extras = await prisma.settlementInstruction.findMany({
      where: {
        OR: [
          { sendingInstitutionId: { in: [noAdapterSendId, ALTA_BANK_INSTITUTION_ID] } },
          { receivingInstitutionId: { in: [noAdapterRecvId, ALTA_TERMINAL_INSTITUTION_ID] } },
        ],
        idempotencyKey: { contains: suffix },
      },
      select: { id: true },
    });
    for (const row of extras) instructionIds.push(row.id);

    const uniqueIds = [...new Set(instructionIds)];
    if (uniqueIds.length > 0) {
      await prisma.settlementReconciliation.deleteMany({
        where: { settlementInstructionId: { in: uniqueIds } },
      });
      await prisma.settlementOutboxEvent.deleteMany({
        where: { settlementInstructionId: { in: uniqueIds } },
      });
      await prisma.terminalCashEntry.deleteMany({
        where: { settlementInstructionId: { in: uniqueIds } },
      });
      await prisma.settlementExecution.deleteMany({
        where: { settlementInstructionId: { in: uniqueIds } },
      });
      await prisma.settlementEntry.deleteMany({
        where: { settlementInstructionId: { in: uniqueIds } },
      });
      await prisma.settlementInstruction.deleteMany({ where: { id: { in: uniqueIds } } });
    }

    await prisma.terminalFundingRequest.deleteMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.terminalWithdrawalRequest.deleteMany({
      where: { userId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    await prisma.terminalCashEntry.deleteMany({
      where: { account: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } } },
    });
    await prisma.bankAccountHold.deleteMany({
      where: { bankAccountId: { in: [bankAccountId, otherBankAccountId].filter(Boolean) } },
    });
    await prisma.bankTransaction.deleteMany({
      where: { bankAccountId: { in: [bankAccountId, otherBankAccountId].filter(Boolean) } },
    });
    await prisma.terminalCashAccount.deleteMany({
      where: { ownerUserId: { in: [userId, otherUserId].filter(Boolean) } },
    });
    for (const id of [bankAccountId, otherBankAccountId]) {
      if (id) await prisma.bankAccount.deleteMany({ where: { id } });
    }
    await prisma.bankAccount.deleteMany({
      where: { accountNumber: frozenBankAccountNumber },
    });
    await prisma.settlementAccount.deleteMany({
      where: { institutionId: { in: [noAdapterSendId, noAdapterRecvId].filter(Boolean) } },
    });
    await prisma.routingNumber.deleteMany({
      where: { id: { in: [noAdapterSendRoutingId, noAdapterRecvRoutingId].filter(Boolean) } },
    });
    await prisma.financialInstitution.deleteMany({
      where: { id: { in: [noAdapterSendId, noAdapterRecvId].filter(Boolean) } },
    });
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
  });

  it("resolves Bank and Terminal account numbers to correct internal accounts", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const bankAdapter = new AltaBankInstitutionAdapter();
    const termAdapter = new AltaTerminalInstitutionAdapter();

    const bankResolved = await bankAdapter.resolveAccount({
      accountNumber: bankAccountNumber,
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(bankResolved.ok, true);
    if (!bankResolved.ok) return;
    assert.equal(bankResolved.account.internalAccountReference, bankAccountId);
    assert.equal(bankResolved.account.canonicalAccountNumber, bankAccountNumber);
    assert.equal(bankResolved.account.maskedAccountNumber, maskPaymentAccountNumber(bankAccountNumber));

    const termResolved = await termAdapter.resolveAccount({
      accountNumber: cash.accountNumber,
      currency: "FLR",
      direction: "credit",
    });
    assert.equal(termResolved.ok, true);
    if (!termResolved.ok) return;
    assert.equal(termResolved.account.internalAccountReference, cash.id);
  });

  it("assigns unique stable Terminal account numbers across provision and re-provision", async () => {
    const first = await ensureUserTerminalCashAccount(userId, "EUR");
    assert.ok(isValidTerminalAccountNumber(first.accountNumber));
    assert.ok(!isLikelyInternalDatabaseId(first.accountNumber));

    const again = await ensureUserTerminalCashAccount(userId, "EUR");
    assert.equal(again.id, first.id);
    assert.equal(again.accountNumber, first.accountNumber);
    assert.equal(again.availableBalance, first.availableBalance);
    assert.equal(again.ledgerBalance, first.ledgerBalance);

    const numbers = new Set<string>();
    for (let i = 0; i < 20; i++) numbers.add(generateTerminalAccountNumber());
    assert.equal(numbers.size, 20);
  });

  it("is race-safe for concurrent Terminal provisioning", async () => {
    const [a, b] = await Promise.all([
      ensureUserTerminalCashAccount(userId, "GBP"),
      ensureUserTerminalCashAccount(userId, "GBP"),
    ]);
    assert.equal(a.id, b.id);
    assert.equal(a.accountNumber, b.accountNumber);
  });

  it("rejects unknown, frozen, wrong-currency, and internal-id payment addresses before ledger", async () => {
    const bankAdapter = new AltaBankInstitutionAdapter();
    const unknown = await bankAdapter.resolveAccount({
      accountNumber: "AB-2000-000000",
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.equal(unknown.code, "ACCOUNT_UNAVAILABLE");

    const frozen = await bankAdapter.resolveAccount({
      accountNumber: frozenBankAccountNumber,
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(frozen.ok, false);
    if (!frozen.ok) assert.equal(frozen.code, "ACCOUNT_UNAVAILABLE");

    const wrongCurrency = await bankAdapter.resolveAccount({
      accountNumber: bankAccountNumber,
      currency: "USD",
      direction: "debit",
    });
    assert.equal(wrongCurrency.ok, false);
    if (!wrongCurrency.ok) assert.equal(wrongCurrency.code, "UNSUPPORTED_CURRENCY");

    const asId = await bankAdapter.resolveAccount({
      accountNumber: bankAccountId,
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(asId.ok, false);
    if (!asId.ok) assert.equal(asId.code, "INVALID_PAYMENT_ADDRESS");

    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
          sendingRoutingNumberId: bankRouting.id,
          receivingRoutingNumberId: terminalRouting.id,
          amount: 1,
          currency: "FLR",
          idempotencyKey: `4a-unknown-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: "AB-2000-000000",
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "ACCOUNT_UNAVAILABLE",
    );

    const entries = await prisma.settlementEntry.count({
      where: {
        instruction: { idempotencyKey: `4a-unknown-${suffix}` },
      },
    });
    assert.equal(entries, 0);
  });

  it("completes Bank → Terminal via account numbers with addressing snapshot", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const beforeBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const beforeCash = asDecimal(cash.availableBalance);

    const result = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "3.00",
      idempotencyKey: `4a-fund-${suffix}`,
    });
    assert.equal(result.status, "COMPLETED");

    const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: result.settlementInstructionId! },
    });
    assert.equal(instruction.status, "SETTLED");
    assert.ok(instruction.sourceAccountNumberMasked);
    assert.ok(instruction.destinationAccountNumberMasked);
    assert.ok(instruction.sendingRoutingNumberUsed);
    assert.ok(instruction.receivingRoutingNumberUsed);
    assert.ok(instruction.addressResolvedAt);
    assert.match(instruction.sourceAccountNumberMasked!, /\*\*/);
    assert.ok(!instruction.sourceAccountNumberMasked!.includes(bankAccountNumber.slice(-6)));

    const metadata = (instruction.metadata ?? {}) as Record<string, unknown>;
    assert.equal(metadata.channel, "bank_website");
    assert.ok(!("sourceAccountReference" in metadata));
    assert.ok(!("destinationAccountReference" in metadata));
    assert.ok(typeof metadata.internalSourceAccountReference === "string");
    assert.ok(typeof metadata.internalDestinationAccountReference === "string");

    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(execution.status, "COMPLETED");
    assert.equal(execution.sourceAccountReference, bankAccountId);
    assert.equal(execution.destinationAccountReference, cash.id);

    const afterBank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(Number(asDecimal(beforeBank.balance).sub(asDecimal(afterBank.balance))), 3);
    assert.equal(Number(asDecimal(afterCash.availableBalance).sub(beforeCash)), 3);
  });

  it("rejects same idempotency key with different account number", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });

    await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 2,
      currency: "FLR",
      idempotencyKey: `4a-idemp-${suffix}`,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: cash.accountNumber,
    });

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
          sendingRoutingNumberId: bankRouting.id,
          receivingRoutingNumberId: terminalRouting.id,
          amount: 2,
          currency: "FLR",
          idempotencyKey: `4a-idemp-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: otherBankAccountNumber,
          destinationAccountNumber: cash.accountNumber,
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  it("returns original settlement for same key and same address payload", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    const key = `4a-resume-${suffix}`;
    const first = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 1.5,
      currency: "FLR",
      idempotencyKey: key,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: cash.accountNumber,
    });
    const second = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 1.5,
      currency: "FLR",
      idempotencyKey: key,
      submittedByUserId: userId,
      sourceAccountNumber: bankAccountNumber,
      destinationAccountNumber: cash.accountNumber,
    });
    assert.equal(first.id, second.id);
    assert.equal(first.publicReference, second.publicReference);
  });

  it("rejects Bank website funding of another customer's account by id", async () => {
    await assert.rejects(
      () =>
        submitTerminalFundingRequest(userId, {
          sourceBankAccountId: otherBankAccountId,
          amount: "1.00",
          idempotencyKey: `4a-other-${suffix}`,
        }),
      (err: unknown) => err instanceof Error,
    );
  });

  it("public API rejects internal database IDs as account numbers", async () => {
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");

    const fakeCtx = {
      institutionId: ALTA_BANK_INSTITUTION_ID,
      credentialId: "cred-4a-test",
      environment: "LIVE" as const,
      scopes: ["settlements:create"],
      credential: { createdByUserId: userId },
      institution: { primaryContactUserId: userId },
    };

    await assert.rejects(
      () =>
        apiSubmitSettlement(fakeCtx as never, {
          receivingRoutingNumber: terminalRouting.routingNumber,
          amount: "1.00",
          sourceAccountNumber: bankAccountId,
          destinationAccountNumber: cash.accountNumber,
          idempotencyKey: `4a-api-id-${suffix}`,
        }),
      (err: unknown) =>
        err instanceof NccApiError &&
        (err.code === "INVALID_PAYMENT_ADDRESS" || err.code === "ACCOUNT_UNAVAILABLE"),
    );
  });

  it("fails missing external adapter before ledger when account numbers require resolution", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: noAdapterRecvId,
          sendingRoutingNumberId: bankRouting.id,
          receivingRoutingNumberId: noAdapterRecvRoutingId,
          amount: 1,
          currency: "FLR",
          idempotencyKey: `4a-no-adapter-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: cash.accountNumber,
        }),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "DESTINATION_ADAPTER_UNAVAILABLE",
    );

    // Destination number belongs to Alta Terminal, not the no-adapter institution —
    // resolution happens against the receiving institution's adapter. Use a Terminal
    // destination with no-adapter sender instead:
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: noAdapterSendId,
          receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
          sendingRoutingNumberId: noAdapterSendRoutingId,
          receivingRoutingNumberId: terminalRouting.id,
          amount: 1,
          currency: "FLR",
          idempotencyKey: `4a-no-src-adapter-${suffix}`,
          submittedByUserId: userId,
          sourceAccountNumber: bankAccountNumber,
          destinationAccountNumber: cash.accountNumber,
        }),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "SOURCE_ADAPTER_UNAVAILABLE",
    );
  });

  it("Terminal → Bank uses the same canonical addressing contract", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    if (asDecimal(cash.availableBalance).lt(10)) {
      await submitTerminalFundingRequest(userId, {
        sourceBankAccountId: bankAccountId,
        amount: "20.00",
        idempotencyKey: `4a-prefund-wd-${suffix}`,
      });
    }
    const refreshed = await getUserTerminalCashAccount(userId, "FLR");
    assert.ok(refreshed);

    const result = await submitTerminalWithdrawalRequest(userId, {
      terminalCashAccountId: refreshed!.id,
      destinationBankAccountId: bankAccountId,
      amount: 5,
      idempotencyKey: `4a-wd-${suffix}`,
    });
    assert.equal(result.status, "COMPLETED");

    const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: result.settlementInstructionId! },
    });
    assert.ok(instruction.sourceAccountNumberMasked);
    assert.ok(instruction.destinationAccountNumberMasked);
    const metadata = (instruction.metadata ?? {}) as Record<string, unknown>;
    assert.ok(!("sourceAccountReference" in metadata));
  });

  it("keeps funding idempotency key across ambiguous retry helper", () => {
    const key = resolveFundingIdempotencyKey(null);
    assert.equal(resolveFundingIdempotencyKey(key), key);
  });

  it("historical settlements remain readable with addressing snapshot after completion", async () => {
    const cash = await ensureUserTerminalCashAccount(userId, "FLR");
    const funded = await submitTerminalFundingRequest(userId, {
      sourceBankAccountId: bankAccountId,
      amount: "1.25",
      idempotencyKey: `4a-hist-${suffix}`,
    });
    const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: funded.settlementInstructionId! },
    });
    assert.ok(instruction.publicReference);
    assert.ok(instruction.sourceAccountNumberMasked);
    assert.ok(instruction.destinationAccountNumberMasked);
    assert.equal(instruction.currency, NCC_DEFAULT_CURRENCY);
    assert.ok(cash.accountNumber);
  });
});
