import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { isDatabaseConfigured } from "@/server/db";
import {
  canInstitutionOriginateSettlement,
  institutionRoleHasPermission,
  isRoutingNumberUsable,
} from "@/lib/ncc/ncc-permissions";
import {
  allocateRoutingNumberCandidate,
  hashSettlementPayload,
  slugifyInstitutionName,
} from "@/lib/ncc/ncc-money";
import {
  cancelInstruction,
  NccSettlementError,
  reverseInstruction,
  reverseNccLedgerPositionsForCompensation,
  getInstruction,
  settleInstruction,
  submitInstruction,
} from "@/server/ncc/ncc-settlement.service";
import { registerInstitutionAdapter } from "@/server/ncc/institution-adapter.registry";
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

/** Float-only adapter for foundation settlement tests (no customer ledger). */
class TestFloatInstitutionAdapter implements InstitutionAdapter {
  constructor(readonly institutionKey: string) {}

  async resolveAccount(): Promise<AdapterResolveResult> {
    return {
      ok: true,
      account: {
        internalAccountReference: "test-float",
        canonicalAccountNumber: "000000000001",
        maskedAccountNumber: "********0001",
        currency: "FLR",
        status: "ACTIVE",
        debitEligible: true,
        creditEligible: true,
        resolvedAt: new Date().toISOString(),
        resolverKey: `${this.institutionKey}@test`,
      },
    };
  }

  async validateAccountReference(): Promise<AdapterValidationResult> {
    return { ok: true, accountReference: "test-float" };
  }

  async prepareDebit(input: InstitutionAdapterDebitInput): Promise<AdapterPreparationResult> {
    return { ok: true, holdReference: `institution-float:${input.settlementInstructionId}` };
  }

  async commitDebit(
    input: InstitutionAdapterDebitInput & { holdReference: string },
  ): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `institution-float-commit:${input.settlementInstructionId}` };
  }

  async releaseDebit(): Promise<void> {}

  async compensateDebit(
    input: InstitutionAdapterDebitInput,
  ): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `institution-float-compensate:${input.settlementInstructionId}` };
  }

  async notifyCredit(input: InstitutionAdapterCreditInput): Promise<AdapterCreditResult> {
    return {
      ok: true,
      credited: true,
      externalReference: `institution-float-credit:${input.settlementInstructionId}`,
    };
  }
}

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

describe("ncc permissions helpers", () => {
  it("blocks inactive institutions from originating", () => {
    assert.equal(canInstitutionOriginateSettlement("ACTIVE"), true);
    assert.equal(canInstitutionOriginateSettlement("SUSPENDED"), false);
    assert.equal(canInstitutionOriginateSettlement("APPLICANT"), false);
  });

  it("enforces role permissions", () => {
    assert.equal(institutionRoleHasPermission("VIEWER", "submit_settlement"), false);
    assert.equal(institutionRoleHasPermission("SETTLEMENT_OPERATOR", "submit_settlement"), true);
    assert.equal(institutionRoleHasPermission("AUDITOR", "manage_members"), false);
  });

  it("only ACTIVE routing numbers are usable", () => {
    assert.equal(isRoutingNumberUsable("ACTIVE"), true);
    assert.equal(isRoutingNumberUsable("SUSPENDED"), false);
    assert.equal(isRoutingNumberUsable("RETIRED"), false);
  });

  it("allocates deterministic routing candidates", () => {
    assert.equal(allocateRoutingNumberCandidate("21", 42), "021000042");
    assert.equal(slugifyInstitutionName("Alta Exchange N.V."), "alta-exchange-n-v");
  });

  it("hashes payloads stably", () => {
    assert.equal(
      hashSettlementPayload({ a: 1, b: "x" }),
      hashSettlementPayload({ a: 1, b: "x" }),
    );
  });
});

describe("ncc settlement engine", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let senderId = "";
  let receiverId = "";
  let sendRoutingId = "";
  let recvRoutingId = "";
  let actorUserId = "";
  let sendAccountId = "";

  before(async () => {
    const user = await prisma.user.create({
      data: {
        discordId: `ncc-test-${suffix}`,
        discordUsername: `ncc_test_${suffix}`,
      },
    });
    actorUserId = user.id;

    const sender = await prisma.financialInstitution.create({
      data: {
        legalName: `Sender Bank ${suffix}`,
        displayName: `Sender ${suffix}`,
        slug: `sender-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
        primaryContactUserId: user.id,
      },
    });
    const receiver = await prisma.financialInstitution.create({
      data: {
        legalName: `Receiver Bank ${suffix}`,
        displayName: `Receiver ${suffix}`,
        slug: `receiver-${suffix}`,
        institutionType: "EXCHANGE",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    senderId = sender.id;
    receiverId = receiver.id;

    registerInstitutionAdapter(new TestFloatInstitutionAdapter(sender.slug));
    registerInstitutionAdapter(new TestFloatInstitutionAdapter(receiver.slug));

    const sendRn = await prisma.routingNumber.create({
      data: {
        institutionId: senderId,
        routingNumber: `9${suffix}`.slice(0, 9).padEnd(9, "0"),
        status: "ACTIVE",
        isPrimary: true,
        activatedAt: new Date(),
      },
    });
    const recvRn = await prisma.routingNumber.create({
      data: {
        institutionId: receiverId,
        routingNumber: `8${suffix}`.slice(0, 9).padEnd(9, "1"),
        status: "ACTIVE",
        isPrimary: true,
        activatedAt: new Date(),
      },
    });
    sendRoutingId = sendRn.id;
    recvRoutingId = recvRn.id;

    const funded = await prisma.settlementAccount.create({
      data: {
        institutionId: senderId,
        currency: "FLR",
        ledgerBalance: new Prisma.Decimal(10_000),
        availableBalance: new Prisma.Decimal(10_000),
        status: "ACTIVE",
      },
    });
    sendAccountId = funded.id;
    await prisma.settlementAccount.create({
      data: {
        institutionId: receiverId,
        currency: "FLR",
        ledgerBalance: 0,
        availableBalance: 0,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    if (!senderId) return;
    const instructions = await prisma.settlementInstruction.findMany({
      where: {
        OR: [
          { sendingInstitutionId: { in: [senderId, receiverId] } },
          { receivingInstitutionId: { in: [senderId, receiverId] } },
        ],
      },
      select: { id: true },
    });
    const instructionIds = instructions.map((row) => row.id);
    if (instructionIds.length > 0) {
      await prisma.nccRiskDecision.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementReconciliation.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementOutboxEvent.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
      await prisma.settlementExecution.deleteMany({
        where: { settlementInstructionId: { in: instructionIds } },
      });
    }
    await prisma.settlementReversal.deleteMany({
      where: {
        OR: [
          { originalInstruction: { sendingInstitutionId: senderId } },
          { originalInstruction: { receivingInstitutionId: senderId } },
        ],
      },
    });
    await prisma.settlementEntry.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.settlementInstruction.deleteMany({
      where: {
        OR: [
          { sendingInstitutionId: { in: [senderId, receiverId] } },
          { receivingInstitutionId: { in: [senderId, receiverId] } },
        ],
      },
    });
    await prisma.settlementAccount.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.nccRiskDecision.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.nccInstitutionRiskPolicy.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.nccDailyRiskUsage.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.routingNumber.deleteMany({
      where: { institutionId: { in: [senderId, receiverId] } },
    });
    await prisma.financialInstitution.deleteMany({
      where: { id: { in: [senderId, receiverId] } },
    });
    if (actorUserId) await prisma.user.delete({ where: { id: actorUserId } }).catch(() => undefined);
  });

  it("settles successfully, balances entries, and completes execution", async () => {
    const instruction = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 100,
      idempotencyKey: `ok-${suffix}`,
      submittedByUserId: actorUserId,
    });
    assert.equal(instruction.status, "SETTLED");

    const entries = await prisma.settlementEntry.findMany({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(entries.length, 2);
    const debit = entries.find((e) => e.entryType === "DEBIT");
    const credit = entries.find((e) => e.entryType === "CREDIT");
    assert.ok(debit && credit);
    assert.equal(Number(debit.amount), Number(credit.amount));

    const execution = await prisma.settlementExecution.findUnique({
      where: { settlementInstructionId: instruction.id },
    });
    assert.ok(execution);
    assert.equal(execution.status, "COMPLETED");
  });

  it("does not use QUEUED as a normal waiting state", async () => {
    const instruction = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 12,
      idempotencyKey: `noqueue-${suffix}`,
      submittedByUserId: actorUserId,
    });
    assert.notEqual(instruction.status, "QUEUED");
    assert.equal(instruction.status, "SETTLED");
  });
  it("returns existing instruction for duplicate idempotency key", async () => {
    const key = `dup-${suffix}`;
    const first = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 50,
      idempotencyKey: key,
      submittedByUserId: actorUserId,
    });
    const second = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 50,
      idempotencyKey: key,
      submittedByUserId: actorUserId,
    });
    assert.equal(first.id, second.id);
  });

  it("rejects same idempotency key with different payload", async () => {
    const key = `conflict-${suffix}`;
    await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 25,
      idempotencyKey: key,
      submittedByUserId: actorUserId,
    });
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: senderId,
          receivingInstitutionId: receiverId,
          sendingRoutingNumberId: sendRoutingId,
          receivingRoutingNumberId: recvRoutingId,
          amount: 26,
          idempotencyKey: key,
          submittedByUserId: actorUserId,
        }),
      (err: unknown) => err instanceof NccSettlementError && err.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  it("fails insufficient funds without mutating balances", async () => {
    const before = await prisma.settlementAccount.findUniqueOrThrow({ where: { id: sendAccountId } });
    const failed = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 999_999,
      idempotencyKey: `nsf-${suffix}`,
      submittedByUserId: actorUserId,
    });
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.failureCode, "INSUFFICIENT_FUNDS");
    const after = await prisma.settlementAccount.findUniqueOrThrow({ where: { id: sendAccountId } });
    assert.equal(Number(after.ledgerBalance), Number(before.ledgerBalance));
  });

  it("denies cancellation after settlement and disables ledger-only reversal", async () => {
    const instruction = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 40,
      idempotencyKey: `rev-${suffix}`,
      submittedByUserId: actorUserId,
    });
    assert.equal(instruction.status, "SETTLED");

    await assert.rejects(
      () => cancelInstruction(instruction.id, actorUserId, "too late"),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "CANCEL_AFTER_SETTLEMENT_DENIED",
    );

    // Sprint 4F: production ledger-only reversal is retired; use transfer-return workflow.
    await assert.rejects(
      () => reverseInstruction(instruction.id, actorUserId, "Ops correction"),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "LEDGER_ONLY_REVERSAL_DISABLED",
    );

    await reverseNccLedgerPositionsForCompensation(
      instruction.id,
      actorUserId,
      "Compensation-path ledger restore",
    );
    const reversed = await getInstruction(instruction.id);
    assert.equal(reversed.status, "REVERSED");

    await assert.rejects(
      () =>
        reverseNccLedgerPositionsForCompensation(instruction.id, actorUserId, "again"),
      (err: unknown) => err instanceof NccSettlementError && err.code === "ALREADY_REVERSED",
    );
  });

  it("denies inactive institution submission", async () => {
    await prisma.financialInstitution.update({
      where: { id: senderId },
      data: { status: "SUSPENDED" },
    });
    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: senderId,
          receivingInstitutionId: receiverId,
          sendingRoutingNumberId: sendRoutingId,
          receivingRoutingNumberId: recvRoutingId,
          amount: 10,
          idempotencyKey: `susp-${suffix}`,
          submittedByUserId: actorUserId,
        }),
      (err: unknown) =>
        err instanceof NccSettlementError && err.code === "INSTITUTION_CANNOT_ORIGINATE",
    );
    await prisma.financialInstitution.update({
      where: { id: senderId },
      data: { status: "ACTIVE" },
    });
  });

  it("does not settle twice", async () => {
    const instruction = await submitInstruction({
      sendingInstitutionId: senderId,
      receivingInstitutionId: receiverId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 15,
      idempotencyKey: `twice-${suffix}`,
      submittedByUserId: actorUserId,
    });
    const again = await settleInstruction(instruction.id, actorUserId);
    assert.equal(again.status, "SETTLED");
    const entryCount = await prisma.settlementEntry.count({
      where: { settlementInstructionId: instruction.id },
    });
    assert.equal(entryCount, 2);
  });
});
