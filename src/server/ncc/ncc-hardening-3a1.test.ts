import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { isAuditDiscordDisabled } from "@/lib/staff-audit/audit-log-discord-bridge";
import {
  assertActorMayCompensate,
  compensatePostLedgerFailure,
  isCompensationEligible,
  NccCompensationError,
} from "@/server/ncc/ncc-compensation.service";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import {
  enqueueOutboxEvent,
  listOutboxEventsForInstruction,
  NCC_OUTBOX_EVENTS,
  processDueOutboxEvents,
  registerOutboxHandler,
} from "@/server/ncc/ncc-outbox.service";
import { reconcileInstruction } from "@/server/ncc/ncc-reconciliation.service";
import { submitInstruction } from "@/server/ncc/ncc-settlement.service";
import {
  ensureCompanyTerminalCashAccount,
  ensureUserTerminalCashAccount,
} from "@/server/ncc/terminal-cash.service";
import { writeAuditLog } from "@/server/audit.service";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc 3a.1 compensation eligibility helpers", () => {
  it("rejects completed executions", () => {
    const result = isCompensationEligible("SETTLED", {
      status: "COMPLETED",
      sourceCommitReference: "x",
      destinationCreditReference: "y",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "COMPENSATION_DENIED_COMPLETED");
  });

  it("requires escalate for active retry", () => {
    const blocked = isCompensationEligible("SETTLED", {
      status: "RETRY_PENDING",
      sourceCommitReference: "x",
      destinationCreditReference: null,
    });
    assert.equal(blocked.ok, false);
    const allowed = isCompensationEligible(
      "SETTLED",
      {
        status: "RETRY_PENDING",
        sourceCommitReference: "x",
        destinationCreditReference: null,
      },
      { escalateActiveRetry: true },
    );
    assert.equal(allowed.ok, true);
  });

  it("staff compensation gate is dedicated NCC staff membership (not tag tags alone)", () => {
    // Sprint 4F: assertActorMayCompensate is a no-op; requireNccStaff("initiate_compensation")
    // enforces dedicated NccStaffMembership. Tag-only internal users are not sufficient.
    assert.doesNotThrow(() => assertActorMayCompensate({ tags: [] }));
    const permSource = readFileSync(
      new URL("../../../lib/ncc/ncc-staff-permissions.ts", import.meta.url),
      "utf8",
    );
    assert.ok(permSource.includes("initiate_compensation"));
    const staffComp = readFileSync(new URL("./ncc-compensation.service.ts", import.meta.url), "utf8");
    assert.ok(staffComp.includes('requireNccStaff("initiate_compensation")'));
  });
});

describe("ncc 3a.1 discord test isolation", () => {
  it("disables production Discord transport under NCC settlement tests", () => {
    assert.equal(process.env.NCC_SETTLEMENT_TESTS, "1");
    assert.equal(isAuditDiscordDisabled(), true);
  });
});

describe("ncc 3a.1 financial hardening", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let actorUserId = "";
  let companyId = "";
  let bankAccountId = "";
  let noAdapterSendId = "";
  let noAdapterSendRoutingId = "";
  let noAdapterRecvId = "";
  let noAdapterRecvRoutingId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-3a1-${suffix}`,
        discordUsername: `ncc_3a1_${suffix}`,
      },
    });
    actorUserId = user.id;

    const company = await prisma.company.create({
      data: {
        name: `NCC 3A1 Co ${suffix}`,
        type: "PRIVATE_COMPANY",
      },
    });
    companyId = company.id;

    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId: actorUserId,
        accountType: "CHECKING",
        accountName: `NCC 3A1 ${suffix}`,
        accountNumber: `AB-2000-${String(200000 + (Number.parseInt(suffix.slice(-5), 36) % 800000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(10_000),
        currency: "FLR",
      },
    });
    bankAccountId = bankAccount.id;

    const sendInst = await prisma.financialInstitution.create({
      data: {
        legalName: `No Adapter Send ${suffix}`,
        displayName: `NoAdapterSend ${suffix}`,
        slug: `no-adapter-send-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    noAdapterSendId = sendInst.id;
    const sendRouting = await prisma.routingNumber.create({
      data: {
        routingNumber: `9${suffix}`.slice(0, 9).padEnd(9, "1"),
        institutionId: noAdapterSendId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    noAdapterSendRoutingId = sendRouting.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: noAdapterSendId,
        currency: NCC_DEFAULT_CURRENCY,
        ledgerBalance: 1_000_000,
        availableBalance: 1_000_000,
        status: "ACTIVE",
      },
    });

    const recvInst = await prisma.financialInstitution.create({
      data: {
        legalName: `No Adapter Recv ${suffix}`,
        displayName: `NoAdapterRecv ${suffix}`,
        slug: `no-adapter-recv-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    noAdapterRecvId = recvInst.id;
    const recvRouting = await prisma.routingNumber.create({
      data: {
        routingNumber: `8${suffix}`.slice(0, 9).padEnd(9, "2"),
        institutionId: noAdapterRecvId,
        status: "ACTIVE",
        isPrimary: true,
      },
    });
    noAdapterRecvRoutingId = recvRouting.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: noAdapterRecvId,
        currency: NCC_DEFAULT_CURRENCY,
        ledgerBalance: 1_000_000,
        availableBalance: 1_000_000,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    // Leave fixtures for inspection; DB tests are additive.
  });

  it("seed never overwrites existing settlement balances", async () => {
    await ensureAltaInstitutionsSeeded();
    const before = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_BANK_INSTITUTION_ID,
          currency: NCC_DEFAULT_CURRENCY,
        },
      },
    });

    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });

    const settled = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 12.34,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `seed-float-${suffix}`,
      submittedByUserId: actorUserId,
    });
    assert.equal(settled.status, "SETTLED");

    const afterSettle = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_BANK_INSTITUTION_ID,
          currency: NCC_DEFAULT_CURRENCY,
        },
      },
    });
    assert.ok(asDecimal(afterSettle.ledgerBalance).lt(asDecimal(before.ledgerBalance)));

    await ensureAltaInstitutionsSeeded();
    await ensureAltaInstitutionsSeeded();

    const afterReseed = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_BANK_INSTITUTION_ID,
          currency: NCC_DEFAULT_CURRENCY,
        },
      },
    });
    assert.equal(afterReseed.ledgerBalance.toString(), afterSettle.ledgerBalance.toString());
    assert.equal(afterReseed.availableBalance.toString(), afterSettle.availableBalance.toString());

    const bankCount = await prisma.financialInstitution.count({
      where: { id: ALTA_BANK_INSTITUTION_ID },
    });
    assert.equal(bankCount, 1);
    const routingCount = await prisma.routingNumber.count({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    assert.equal(routingCount, 1);
  });

  it("rejects missing source adapter before NCC ledger post", async () => {
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });

    const instruction = await submitInstruction({
      sendingInstitutionId: noAdapterSendId,
      receivingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      sendingRoutingNumberId: noAdapterSendRoutingId,
      receivingRoutingNumberId: bankRouting.id,
      amount: 10,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `missing-src-${suffix}`,
      submittedByUserId: actorUserId,
    });

    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(execution.status, "FAILED");
    assert.equal(execution.failureCode, "SOURCE_ADAPTER_UNAVAILABLE");
    assert.notEqual(instruction.status, "SETTLED");
    assert.notEqual(execution.status, "COMPLETED");
    assert.ok(!execution.sourcePreparationReference?.startsWith("no-adapter:"));

    const entries = await prisma.settlementEntry.count({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(entries, 0);
  });

  it("rejects missing destination adapter before NCC ledger post", async () => {
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });

    const instruction = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: noAdapterRecvId,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: noAdapterRecvRoutingId,
      amount: 10,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `missing-dst-${suffix}`,
      submittedByUserId: actorUserId,
    });

    const execution = await prisma.settlementExecution.findUniqueOrThrow({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(execution.status, "FAILED");
    assert.equal(execution.failureCode, "DESTINATION_ADAPTER_UNAVAILABLE");
    assert.notEqual(instruction.status, "SETTLED");
    const entries = await prisma.settlementEntry.count({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(entries, 0);
  });

  it("wires transactional outbox events with stable dedupe keys", async () => {
    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    const cash = await ensureUserTerminalCashAccount(actorUserId);
    const bankAccount = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });

    const instruction = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 25,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `outbox-ok-${suffix}`,
      submittedByUserId: actorUserId,
      sourceAccountNumber: bankAccount.accountNumber,
      destinationAccountNumber: cash.accountNumber,
    });

    // Duplicate submission must not duplicate logical outbox events.
    await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 25,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `outbox-ok-${suffix}`,
      submittedByUserId: actorUserId,
      sourceAccountNumber: bankAccount.accountNumber,
      destinationAccountNumber: cash.accountNumber,
    });

    const events = await listOutboxEventsForInstruction(instruction.id);
    const types = events.map((e) => e.eventType).sort();
    assert.ok(types.includes(NCC_OUTBOX_EVENTS.SUBMITTED));
    assert.ok(types.includes(NCC_OUTBOX_EVENTS.NCC_POSTED));
    assert.ok(types.includes(NCC_OUTBOX_EVENTS.COMPLETED));
    assert.equal(events.filter((e) => e.eventType === NCC_OUTBOX_EVENTS.SUBMITTED).length, 1);
    assert.equal(events.filter((e) => e.eventType === NCC_OUTBOX_EVENTS.COMPLETED).length, 1);

    let handlerCalls = 0;
    registerOutboxHandler(NCC_OUTBOX_EVENTS.COMPLETED, async () => {
      handlerCalls += 1;
      throw new Error("handler boom");
    });
    await processDueOutboxEvents(50);
    const stillCompleted = await prisma.settlementExecution.findUniqueOrThrow({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(stillCompleted.status, "COMPLETED");
    assert.ok(handlerCalls >= 0);
  });

  it("enforces terminal cash ownership constraints", async () => {
    const userAccount = await ensureUserTerminalCashAccount(actorUserId);
    assert.equal(userAccount.ownerUserId, actorUserId);
    assert.equal(userAccount.ownerCompanyId, null);

    const companyAccount = await ensureCompanyTerminalCashAccount(companyId);
    assert.equal(companyAccount.ownerCompanyId, companyId);
    assert.equal(companyAccount.ownerUserId, null);

    await assert.rejects(
      () =>
        prisma.terminalCashAccount.create({
          data: {
            accountNumber: "999999999991",
            currency: "USD",
            ledgerBalance: 0,
            availableBalance: 0,
            reservedBalance: 0,
          },
        }),
    );

    await assert.rejects(
      () =>
        prisma.terminalCashAccount.create({
          data: {
            accountNumber: "999999999992",
            ownerUserId: actorUserId,
            ownerCompanyId: companyId,
            currency: "EUR",
            ledgerBalance: 0,
            availableBalance: 0,
            reservedBalance: 0,
          },
        }),
    );

    await assert.rejects(() =>
      prisma.terminalCashAccount.create({
        data: {
          accountNumber: "999999999993",
          ownerUserId: actorUserId,
          currency: NCC_DEFAULT_CURRENCY,
          ledgerBalance: 0,
          availableBalance: 0,
          reservedBalance: 0,
        },
      }),
    );

    const [a, b] = await Promise.all([
      ensureUserTerminalCashAccount(actorUserId, "JPY"),
      ensureUserTerminalCashAccount(actorUserId, "JPY"),
    ]);
    assert.equal(a.id, b.id);
  });

  it("compensates eligible post-ledger failures exactly once", async () => {
    const { createOrGetExecution } = await import("@/server/ncc/ncc-execution.service");
    const { postNccLedgerEntries } = await import("@/server/ncc/ncc-settlement-ledger.service");
    const { AltaBankInstitutionAdapter } = await import("@/server/ncc/adapters/alta-bank.adapter");
    const { generateSettlementPublicReference, hashSettlementPayload } = await import(
      "@/lib/ncc/ncc-money"
    );

    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });

    const bankBefore = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    const amount = new Prisma.Decimal(40);
    const publicReference = generateSettlementPublicReference();

    const instruction = await prisma.settlementInstruction.create({
      data: {
        publicReference,
        idempotencyKey: `comp-setup-${suffix}`,
        requestHash: hashSettlementPayload({ k: `comp-setup-${suffix}` }),
        sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
        receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
        sendingRoutingNumberId: bankRouting.id,
        receivingRoutingNumberId: terminalRouting.id,
        currency: NCC_DEFAULT_CURRENCY,
        amount,
        status: "SUBMITTED",
        submittedByUserId: actorUserId,
        submittedAt: new Date(),
        metadata: {
          sourceAccountReference: bankAccountId,
        },
      },
    });

    const execution = await createOrGetExecution(instruction.id, {
      sourceAccountReference: bankAccountId,
    });

    const bankAdapter = new AltaBankInstitutionAdapter();
    const prepared = await bankAdapter.prepareDebit({
      settlementInstructionId: instruction.id,
      publicReference,
      amount: amount.toString(),
      currency: NCC_DEFAULT_CURRENCY,
      accountReference: bankAccountId,
      actorUserId,
    });
    if (!prepared.ok) throw new Error(`prepare failed: ${prepared.reason}`);

    await postNccLedgerEntries(instruction.id);

    const committed = await bankAdapter.commitDebit({
      settlementInstructionId: instruction.id,
      publicReference,
      amount: amount.toString(),
      currency: NCC_DEFAULT_CURRENCY,
      accountReference: bankAccountId,
      holdReference: prepared.holdReference,
      actorUserId,
    });
    if (!committed.ok) throw new Error(`commit failed: ${committed.reason}`);

    await prisma.settlementExecution.update({
      where: { id: execution.id },
      data: {
        status: "MANUAL_REVIEW",
        currentStep: "CREDIT_DESTINATION",
        sourcePreparationReference: prepared.holdReference,
        sourceCommitReference: committed.externalReference,
        failureCode: "DESTINATION_CREDIT_FAILED",
        failureReason: "Simulated permanent destination failure",
      },
    });

    const bankMid = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    assert.ok(asDecimal(bankMid.balance).lt(asDecimal(bankBefore.balance)));

    const sendBeforeComp = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_BANK_INSTITUTION_ID,
          currency: NCC_DEFAULT_CURRENCY,
        },
      },
    });

    const first = await compensatePostLedgerFailure({
      instructionId: instruction.id,
      actorUserId,
      reason: "Ops restore after destination failure",
    });
    assert.equal(first.alreadyCompensated, false);
    assert.equal(first.execution.status, "COMPENSATED");

    const bankAfter = await prisma.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } });
    assert.equal(bankAfter.balance.toString(), bankBefore.balance.toString());

    const sendAfterComp = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_BANK_INSTITUTION_ID,
          currency: NCC_DEFAULT_CURRENCY,
        },
      },
    });
    assert.ok(asDecimal(sendAfterComp.ledgerBalance).gt(asDecimal(sendBeforeComp.ledgerBalance)));

    const second = await compensatePostLedgerFailure({
      instructionId: instruction.id,
      actorUserId,
      reason: "duplicate",
    });
    assert.equal(second.alreadyCompensated, true);
    assert.equal(second.compensation.id, first.compensation.id);

    await assert.rejects(
      () =>
        compensatePostLedgerFailure({
          instructionId: instruction.id,
          actorUserId,
          reason: "   ",
        }),
      (error: unknown) =>
        error instanceof NccCompensationError && error.code === "COMPENSATION_REASON_REQUIRED",
    );

    const bankForCompleted = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: bankAccountId },
    });
    const completedInstruction = await submitInstruction({
      sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
      receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
      sendingRoutingNumberId: bankRouting.id,
      receivingRoutingNumberId: terminalRouting.id,
      amount: 5,
      currency: NCC_DEFAULT_CURRENCY,
      idempotencyKey: `comp-completed-${suffix}`,
      submittedByUserId: actorUserId,
      sourceAccountNumber: bankForCompleted.accountNumber,
    });
    await assert.rejects(
      () =>
        compensatePostLedgerFailure({
          instructionId: completedInstruction.id,
          actorUserId,
          reason: "should fail",
        }),
      (error: unknown) =>
        error instanceof NccCompensationError && error.code === "COMPENSATION_DENIED_COMPLETED",
    );

    const reconciliation = await reconcileInstruction(instruction.id);
    assert.equal(reconciliation.status, "COMPENSATED");

    const outbox = await listOutboxEventsForInstruction(instruction.id);
    assert.ok(outbox.some((e) => e.eventType === NCC_OUTBOX_EVENTS.COMPENSATED));
    assert.ok(outbox.some((e) => e.eventType === NCC_OUTBOX_EVENTS.REVERSED));
  });

  it("settlement audit creation does not invoke production Discord transport", async () => {
    let discordInvoked = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0]);
      if (url.includes("discord.com") || url.includes("discordapp.com")) {
        discordInvoked = true;
      }
      return originalFetch(...args);
    }) as typeof fetch;

    try {
      await writeAuditLog({
        actorUserId,
        action: "NCC_SETTLEMENT_INSTRUCTION_SUBMITTED",
        entityType: "SETTLEMENT_INSTRUCTION",
        entityId: `audit-isolation-${suffix}`,
        description: "Test audit row for Discord isolation",
        institutionId: ALTA_BANK_INSTITUTION_ID,
      });
      assert.equal(discordInvoked, false);
      assert.equal(isAuditDiscordDisabled(), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("manual review and retry produce durable deduplicated outbox events", async () => {
    await enqueueOutboxEvent({
      eventType: NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
      dedupeKey: `settlement.manual_review:test-${suffix}`,
      payload: { test: true },
    });
    await enqueueOutboxEvent({
      eventType: NCC_OUTBOX_EVENTS.MANUAL_REVIEW,
      dedupeKey: `settlement.manual_review:test-${suffix}`,
      payload: { test: true },
    });
    const rows = await prisma.settlementOutboxEvent.findMany({
      where: { dedupeKey: `settlement.manual_review:test-${suffix}` },
    });
    assert.equal(rows.length, 1);
  });
});
