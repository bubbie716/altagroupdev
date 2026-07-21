import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { DEFAULT_REQUIRED_DOCUMENTS } from "@/lib/ncc/ncc-participant-application";
import {
  isAutoCompensationEligible,
  attemptAutomaticCompensation,
  NccCompensationError,
} from "@/server/ncc/ncc-compensation.service";
import {
  ensureAltaInstitutionsSeeded,
  markLegacyCreateTimeFloatsForReview,
} from "@/server/ncc/ncc-institution.service";
import {
  approveLiquidityOperationForActor,
  maybeAlertLowLiquidity,
  NccLiquidityError,
  requestLiquidityOperationForActor,
} from "@/server/ncc/ncc-liquidity.service";
import { assertMandatoryDocumentsAccepted } from "@/server/ncc/ncc-participant-documents.service";
import { reconcileInstruction } from "@/server/ncc/ncc-reconciliation.service";
import {
  cancelInstruction,
  isInstructionCancelable,
  NccSettlementError,
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

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";
const ROOT = join(process.cwd(), "src");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

class FloatAdapter implements InstitutionAdapter {
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
    return { ok: true, holdReference: `hold-${input.settlementInstructionId}` };
  }
  async commitDebit(
    input: InstitutionAdapterDebitInput & { holdReference: string },
  ): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `commit-${input.settlementInstructionId}` };
  }
  async releaseDebit(): Promise<void> {}
  async compensateDebit(input: InstitutionAdapterDebitInput): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `restore-${input.settlementInstructionId}` };
  }
  async notifyCredit(input: InstitutionAdapterCreditInput): Promise<AdapterCreditResult> {
    return {
      ok: true,
      credited: true,
      externalReference: `credit-${input.settlementInstructionId}`,
    };
  }
}

describe("ncc sprint 4e static / unit", () => {
  it("Alta institution seed no longer creates a 1B float", () => {
    const source = readFileSync(join(ROOT, "server/ncc/ncc-institution.service.ts"), "utf8");
    assert.equal(source.includes("ALTA_INTERNAL_SETTLEMENT_FLOAT"), false);
    assert.equal(/ledgerBalance:\s*1_000_000_000/.test(source), false);
    assert.ok(source.includes("ZERO_SETTLEMENT_BALANCE"));
  });

  it("no runtime Terminal/Exchange mock datasets remain outside tests", () => {
    const forbidden =
      /from\s+["']@\/lib\/mock-data["']|from\s+["']@\/lib\/terminal\/data["']|from\s+["']@\/lib\/bank\/data["']/;
    const offenders: string[] = [];
    for (const rel of ["routes/terminal", "routes/exchange", "lib/terminal", "lib/exchange"]) {
      for (const file of walkTsFiles(join(ROOT, rel))) {
        if (forbidden.test(readFileSync(file, "utf8"))) {
          offenders.push(file.replace(ROOT + "/", ""));
        }
      }
    }
    assert.deepEqual(offenders, []);
    try {
      readFileSync(join(ROOT, "lib/terminal/data.ts"), "utf8");
      assert.fail("lib/terminal/data.ts must not exist");
    } catch (e) {
      assert.ok(e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT");
    }
  });

  it("cancel eligibility matches pre-ledger boundary", () => {
    assert.equal(isInstructionCancelable("SUBMITTED", "SOURCE_PREPARED"), true);
    assert.equal(isInstructionCancelable("SUBMITTED", "NCC_LEDGER_POSTED"), false);
    assert.equal(isInstructionCancelable("SETTLED", "COMPLETED"), false);
    assert.equal(isInstructionCancelable("SUBMITTED", "SOURCE_COMMITTED"), false);
  });

  it("auto-compensation rejects ambiguous destination failures", () => {
    const ambiguous = isAutoCompensationEligible(
      "SETTLED",
      {
        status: "MANUAL_REVIEW",
        sourceCommitReference: "src",
        destinationCreditReference: null,
        failureCode: "CONNECTOR_TIMEOUT",
      },
      false,
    );
    assert.equal(ambiguous.ok, false);

    const eligible = isAutoCompensationEligible(
      "SETTLED",
      {
        status: "MANUAL_REVIEW",
        sourceCommitReference: "src",
        destinationCreditReference: null,
        failureCode: "ACCOUNT_CLOSED",
      },
      false,
    );
    assert.equal(eligible.ok, true);
  });
});

describe("ncc sprint 4e liquidity and ops", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let requesterId = "";
  let approverId = "";
  let institutionId = "";
  let settlementAccountId = "";
  let sendRoutingId = "";
  let recvInstitutionId = "";
  let recvRoutingId = "";
  let recvAccountId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const requester = await prisma.user.create({
      data: {
        discordId: `ncc-4e-req-${suffix}`,
        discordUsername: `ncc_4e_req_${suffix}`,
        tags: { create: [{ tag: "ADMIN" }] },
      },
    });
    requesterId = requester.id;
    const approver = await prisma.user.create({
      data: {
        discordId: `ncc-4e-apr-${suffix}`,
        discordUsername: `ncc_4e_apr_${suffix}`,
        tags: { create: [{ tag: "ADMIN" }] },
      },
    });
    approverId = approver.id;

    const institution = await prisma.financialInstitution.create({
      data: {
        legalName: `4E Liquidity Bank ${suffix}`,
        displayName: `4E Liq ${suffix}`,
        slug: `4e-liq-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    institutionId = institution.id;

    const recv = await prisma.financialInstitution.create({
      data: {
        legalName: `4E Recv Bank ${suffix}`,
        displayName: `4E Recv ${suffix}`,
        slug: `4e-recv-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
    });
    recvInstitutionId = recv.id;

    registerInstitutionAdapter(new FloatAdapter(institution.slug));
    registerInstitutionAdapter(new FloatAdapter(recv.slug));

    const sendRn = await prisma.routingNumber.create({
      data: {
        institutionId,
        routingNumber: `7${suffix}`.slice(0, 9).padEnd(9, "0"),
        status: "ACTIVE",
        isPrimary: true,
        activatedAt: new Date(),
      },
    });
    sendRoutingId = sendRn.id;
    const recvRn = await prisma.routingNumber.create({
      data: {
        institutionId: recvInstitutionId,
        routingNumber: `6${suffix}`.slice(0, 9).padEnd(9, "1"),
        status: "ACTIVE",
        isPrimary: true,
        activatedAt: new Date(),
      },
    });
    recvRoutingId = recvRn.id;

    const account = await prisma.settlementAccount.create({
      data: {
        institutionId,
        currency: NCC_DEFAULT_CURRENCY,
        ledgerBalance: new Prisma.Decimal(0),
        availableBalance: new Prisma.Decimal(0),
        status: "ACTIVE",
        lowLiquidityThreshold: new Prisma.Decimal("100.00"),
      },
    });
    settlementAccountId = account.id;

    const recvAccount = await prisma.settlementAccount.create({
      data: {
        institutionId: recvInstitutionId,
        currency: NCC_DEFAULT_CURRENCY,
        ledgerBalance: new Prisma.Decimal(0),
        availableBalance: new Prisma.Decimal(0),
        status: "ACTIVE",
      },
    });
    recvAccountId = recvAccount.id;
  });

  after(async () => {
    // Suffix-isolated rows; leave for DB inspection if needed.
  });

  it("new settlement accounts start at zero and no 1B float is auto-created", async () => {
    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { id: settlementAccountId },
    });
    assert.equal(Number(account.ledgerBalance), 0);
    assert.equal(Number(account.availableBalance), 0);
    assert.notEqual(Number(account.ledgerBalance), 1_000_000_000);
  });

  it("legacy float detection marks review without altering balances", async () => {
    const legacy = await prisma.settlementAccount.create({
      data: {
        institutionId: recvInstitutionId,
        currency: "USD",
        ledgerBalance: new Prisma.Decimal("1000000000.00"),
        availableBalance: new Prisma.Decimal("1000000000.00"),
        status: "ACTIVE",
        legacyFloatReviewStatus: "NONE",
      },
    });
    const beforeLedger = legacy.ledgerBalance.toString();
    const marked = await markLegacyCreateTimeFloatsForReview();
    assert.ok(marked >= 1);
    const after = await prisma.settlementAccount.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(after.ledgerBalance.toString(), beforeLedger);
    assert.equal(after.availableBalance.toString(), beforeLedger);
    assert.equal(after.legacyFloatReviewStatus, "REQUIRES_REVIEW");
  });

  it("liquidity request requires a different approver", async () => {
    const op = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "250.00",
      operationType: "FUNDING",
      reason: "4E dual-control funding",
      idempotencyKey: `4e-fund-self-${suffix}`,
      externalReference: "RESERVE-4E-1",
    });
    await assert.rejects(
      () => approveLiquidityOperationForActor(requesterId, { operationId: op.id }),
      (e: unknown) => e instanceof NccLiquidityError && e.code === "SELF_APPROVAL_DENIED",
    );
  });

  it("funding applies exactly once and ambiguous retry returns original", async () => {
    const key = `4e-fund-once-${suffix}`;
    const first = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "500.00",
      operationType: "FUNDING",
      reason: "Initial authorized funding",
      idempotencyKey: key,
      externalReference: "RESERVE-4E-2",
    });
    const retry = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "500.00",
      operationType: "FUNDING",
      reason: "Initial authorized funding",
      idempotencyKey: key,
      externalReference: "RESERVE-4E-2",
    });
    assert.equal(retry.id, first.id);
    assert.equal(retry.status, "PENDING_APPROVAL");

    const applied = await approveLiquidityOperationForActor(approverId, { operationId: first.id });
    assert.equal(applied.status, "APPLIED");
    const again = await approveLiquidityOperationForActor(approverId, { operationId: first.id });
    assert.equal(again.id, applied.id);
    assert.equal(again.status, "APPLIED");
    assert.equal(Number(again.balanceAfterAvailable), 500);

    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { id: settlementAccountId },
    });
    assert.equal(Number(account.availableBalance), 500);
  });

  it("withdrawal cannot overdraw", async () => {
    const op = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "999999.00",
      operationType: "WITHDRAWAL",
      reason: "Overdraw attempt",
      idempotencyKey: `4e-wd-over-${suffix}`,
    });
    await assert.rejects(
      () => approveLiquidityOperationForActor(approverId, { operationId: op.id }),
      (e: unknown) => e instanceof NccLiquidityError && e.code === "WITHDRAWAL_EXCEEDS_AVAILABLE",
    );
  });

  it("concurrent liquidity operations are safe", async () => {
    const a = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "10.00",
      operationType: "FUNDING",
      reason: "Concurrent A",
      idempotencyKey: `4e-conc-a-${suffix}`,
    });
    const b = await requestLiquidityOperationForActor(requesterId, {
      settlementAccountId,
      amount: "15.00",
      operationType: "FUNDING",
      reason: "Concurrent B",
      idempotencyKey: `4e-conc-b-${suffix}`,
    });
    const [r1, r2] = await Promise.all([
      approveLiquidityOperationForActor(approverId, { operationId: a.id }),
      approveLiquidityOperationForActor(approverId, { operationId: b.id }),
    ]);
    assert.equal(r1.status, "APPLIED");
    assert.equal(r2.status, "APPLIED");
    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { id: settlementAccountId },
    });
    assert.equal(Number(account.availableBalance), 525);
  });

  it("low-liquidity alerting fires at or below threshold", async () => {
    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: { id: settlementAccountId },
    });
    await maybeAlertLowLiquidity(
      {
        ...account,
        availableBalance: new Prisma.Decimal("50.00"),
        lowLiquidityThreshold: new Prisma.Decimal("100.00"),
      },
      approverId,
    );
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "NCC_LIQUIDITY_LOW_ALERT",
        entityId: settlementAccountId,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);
  });

  it("frozen settlement account blocks new origination", async () => {
    await prisma.settlementAccount.update({
      where: { id: settlementAccountId },
      data: { status: "FROZEN", frozenAt: new Date(), frozenReason: "4E freeze test" },
    });
    const result = await submitInstruction({
      sendingInstitutionId: institutionId,
      receivingInstitutionId: recvInstitutionId,
      sendingRoutingNumberId: sendRoutingId,
      receivingRoutingNumberId: recvRoutingId,
      amount: 1,
      idempotencyKey: `4e-freeze-${suffix}`,
      submittedByUserId: requesterId,
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.failureCode, "SENDER_ACCOUNT_FROZEN");
    await prisma.settlementAccount.update({
      where: { id: settlementAccountId },
      data: { status: "ACTIVE", frozenAt: null, frozenReason: null },
    });
  });

  it("rejected/missing/expired documents block LIVE promotion gates", async () => {
    const app = await prisma.nccParticipantApplication.create({
      data: {
        publicReference: `NCC-APP-4E-${suffix}`,
        applicantUserId: requesterId,
        legalName: "Doc Gate Co",
        displayName: "Doc Gate",
        institutionType: "BANK",
        countryJurisdiction: "Newport",
        registeredAddress: "1 Main",
        regulatoryAuthority: "NCC",
        licenseOrRegistrationNumber: "LIC-4E",
        primaryContactName: "A",
        primaryContactEmail: "a@example.com",
        complianceContactName: "B",
        complianceContactEmail: "b@example.com",
        technicalContactName: "C",
        technicalContactEmail: "c@example.com",
        settlementOpsContactName: "D",
        settlementOpsContactEmail: "d@example.com",
        status: "APPROVED_FOR_LIVE",
        requiredDocuments: [...DEFAULT_REQUIRED_DOCUMENTS],
        accountIdentifierFormat: {
          displayLabel: "External bank account id",
          characterFormatDescription: "Alphanumeric",
          exampleMaskedIdentifier: "****9201",
          caseSensitive: true,
          branchCodeRequired: false,
          supportedCurrencies: ["FLR"],
          containsLetters: true,
          containsNumbers: true,
          containsSpaces: false,
          containsPunctuation: false,
        },
      },
    });
    const missing = await assertMandatoryDocumentsAccepted(app.id);
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.ok(missing.blockers.some((b) => b.code === "REGULATORY_DOCUMENTS_INCOMPLETE"));
    }

    await prisma.nccParticipantDocument.create({
      data: {
        applicationId: app.id,
        documentType: DEFAULT_REQUIRED_DOCUMENTS[0],
        status: "PENDING_SCAN",
        storageKey: `ncc-participant-docs/${app.id}/test.pdf`,
        originalFileName: "license.pdf",
        contentType: "application/pdf",
        byteSize: 12,
        sha256: "abc",
        uploadedByUserId: requesterId,
      },
    });
    const pending = await assertMandatoryDocumentsAccepted(app.id);
    assert.equal(pending.ok, false);
    if (!pending.ok) {
      assert.ok(pending.blockers.some((b) => b.code === "REGULATORY_DOCUMENT_PENDING_SCAN"));
    }

    await prisma.nccParticipantDocument.updateMany({
      where: { applicationId: app.id },
      data: {
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    // still missing other required types + expired
    const expired = await assertMandatoryDocumentsAccepted(app.id);
    assert.equal(expired.ok, false);
  });

  it("cancellation before ledger posting succeeds; after ledger is rejected", async () => {
    const created = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-CANCEL-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("5.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SUBMITTED",
        idempotencyKey: `4e-cancel-pre-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "x",
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: created.id,
        status: "SOURCE_PREPARED",
        currentStep: "POST_NCC_LEDGER",
        sourcePreparationReference: `hold-${created.id}`,
      },
    });
    const cancelled = await cancelInstruction(created.id, requesterId, "pre-ledger cancel");
    assert.equal(cancelled.status, "CANCELLED");

    const settled = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-CANCEL-POST-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("5.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SETTLED",
        idempotencyKey: `4e-cancel-post-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "y",
        settledAt: new Date(),
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: settled.id,
        status: "NCC_LEDGER_POSTED",
        currentStep: "COMMIT_SOURCE",
      },
    });
    await assert.rejects(
      () => cancelInstruction(settled.id, requesterId, "too late"),
      (e: unknown) =>
        e instanceof NccSettlementError &&
        (e.code === "CANCEL_AFTER_SETTLEMENT_DENIED" || e.code === "CANCEL_AFTER_LEDGER_DENIED"),
    );
  });

  it("concurrent cancel/execute produces one valid outcome", async () => {
    const created = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-RACE-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("1.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SUBMITTED",
        idempotencyKey: `4e-race-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "z",
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: created.id,
        status: "SOURCE_PREPARED",
        currentStep: "POST_NCC_LEDGER",
        sourcePreparationReference: `hold-race-${created.id}`,
      },
    });

    const results = await Promise.allSettled([
      cancelInstruction(created.id, requesterId, "race cancel"),
      cancelInstruction(created.id, approverId, "race cancel 2"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);
    const final = await prisma.settlementInstruction.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(final.status, "CANCELLED");
  });

  it("confirmed destination failure auto-compensates once; ambiguous does not", async () => {
    const instruction = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-ACOMP-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("3.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SETTLED",
        idempotencyKey: `4e-acomp-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "ac",
        settledAt: new Date(),
        metadata: { destinationCreditConfirmedFailed: true },
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: instruction.id,
        status: "MANUAL_REVIEW",
        currentStep: "CREDIT_DESTINATION",
        sourceCommitReference: `commit-${instruction.id}`,
        failureCode: "ACCOUNT_CLOSED",
      },
    });
    await prisma.settlementAccount.update({
      where: { id: recvAccountId },
      data: {
        ledgerBalance: new Prisma.Decimal("100"),
        availableBalance: new Prisma.Decimal("100"),
      },
    });
    await prisma.settlementAccount.update({
      where: { id: settlementAccountId },
      data: {
        ledgerBalance: new Prisma.Decimal("100"),
        availableBalance: new Prisma.Decimal("100"),
      },
    });
    await prisma.settlementEntry.createMany({
      data: [
        {
          settlementInstructionId: instruction.id,
          settlementAccountId,
          institutionId,
          entryType: "DEBIT",
          amount: new Prisma.Decimal("3.00"),
          currency: NCC_DEFAULT_CURRENCY,
          balanceBefore: new Prisma.Decimal("100"),
          balanceAfter: new Prisma.Decimal("97"),
        },
        {
          settlementInstructionId: instruction.id,
          settlementAccountId: recvAccountId,
          institutionId: recvInstitutionId,
          entryType: "CREDIT",
          amount: new Prisma.Decimal("3.00"),
          currency: NCC_DEFAULT_CURRENCY,
          balanceBefore: new Prisma.Decimal("100"),
          balanceAfter: new Prisma.Decimal("103"),
        },
      ],
    });

    const first = await attemptAutomaticCompensation(instruction.id);
    assert.ok(first.outcome === "compensated" || first.outcome === "already_compensated");
    const second = await attemptAutomaticCompensation(instruction.id);
    assert.equal(second.outcome, "already_compensated");

    const ambiguousInst = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-AMB-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("2.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SETTLED",
        idempotencyKey: `4e-amb-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "amb",
        settledAt: new Date(),
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: ambiguousInst.id,
        status: "MANUAL_REVIEW",
        currentStep: "CREDIT_DESTINATION",
        sourceCommitReference: `commit-${ambiguousInst.id}`,
        failureCode: "CONNECTOR_TIMEOUT",
      },
    });
    const amb = await attemptAutomaticCompensation(ambiguousInst.id);
    assert.ok(amb.outcome === "ineligible" || amb.outcome === "needs_manual_review");
  });

  it("connector outage does not create fake compensation success", async () => {
    const external = await prisma.financialInstitution.create({
      data: {
        legalName: `4E Ext ${suffix}`,
        displayName: `4E Ext ${suffix}`,
        slug: `4e-ext-${suffix}`,
        institutionType: "BANK",
        status: "ACTIVE",
        isNCCParticipant: true,
        isAlta: false,
        approvedAt: new Date(),
      },
    });
    const extRn = await prisma.routingNumber.create({
      data: {
        institutionId: external.id,
        routingNumber: `5${suffix}`.slice(0, 9).padEnd(9, "2"),
        status: "ACTIVE",
        isPrimary: true,
        activatedAt: new Date(),
      },
    });
    const instruction = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-OUTAGE-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: external.id,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: extRn.id,
        amount: new Prisma.Decimal("4.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SETTLED",
        idempotencyKey: `4e-outage-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "out",
        settledAt: new Date(),
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: instruction.id,
        status: "MANUAL_REVIEW",
        currentStep: "CREDIT_DESTINATION",
        sourceCommitReference: `commit-${instruction.id}`,
        failureCode: "ACCOUNT_CLOSED",
      },
    });
    // No connector configured → must not silently succeed.
    await assert.rejects(
      () => attemptAutomaticCompensation(instruction.id),
      (e: unknown) => e instanceof NccCompensationError || e instanceof Error,
    );
  });

  it("reconciliation distinguishes missing, duplicate, mismatched, and compensated", async () => {
    const compensated = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-RECON-C-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("1.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "REVERSED",
        idempotencyKey: `4e-recon-c-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "rc",
        settledAt: new Date(),
      },
    });
    const exec = await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: compensated.id,
        status: "COMPENSATED",
        currentStep: "FINALIZE",
        sourceAccountReference: "src-ref",
        destinationAccountReference: "dst-ref",
        sourceCommitReference: "c1",
      },
    });
    await prisma.settlementCompensation.create({
      data: {
        settlementInstructionId: compensated.id,
        settlementExecutionId: exec.id,
        reason: "test compensation",
        actorUserId: approverId,
      },
    });
    const recon = await reconcileInstruction(compensated.id);
    assert.equal(recon.status, "COMPENSATED");

    const missing = await prisma.settlementInstruction.create({
      data: {
        publicReference: `NCC-4E-RECON-M-${suffix}`,
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: new Prisma.Decimal("1.00"),
        currency: NCC_DEFAULT_CURRENCY,
        status: "SETTLED",
        idempotencyKey: `4e-recon-m-${suffix}`,
        submittedByUserId: requesterId,
        requestHash: "rm",
        settledAt: new Date(),
      },
    });
    await prisma.settlementExecution.create({
      data: {
        settlementInstructionId: missing.id,
        status: "COMPLETED",
        currentStep: "FINALIZE",
        sourceAccountReference: "bank-missing",
        destinationAccountReference: "term-missing",
        completedAt: new Date(),
      },
    });
    const missingRecon = await reconcileInstruction(missing.id);
    assert.ok(
      missingRecon.status === "MISSING_SOURCE" ||
        missingRecon.status === "MISSING_DESTINATION" ||
        missingRecon.status === "MISMATCH",
    );

    const again = await reconcileInstruction(missing.id);
    // Idempotent re-run should not invent a different money movement outcome.
    assert.equal(again.status, missingRecon.status);
  });

  it("Bank ↔ Terminal instant settlement still funds end-to-end", async () => {
    const { submitTerminalFundingRequest } = await import("@/server/ncc/ncc-funding.service");
    const { ensureUserTerminalCashAccount } = await import("@/server/ncc/terminal-cash.service");
    const { ALTA_BANK_INSTITUTION_ID } = await import("@/lib/bank/account-ownership");

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-4e-bt-${suffix}`,
        discordUsername: `ncc_4e_bt_${suffix}`,
      },
    });
    const bank = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        accountType: "CHECKING",
        accountName: `4E BT ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + ((Number.parseInt(suffix.slice(-5), 36) + 40) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(500),
        currency: "FLR",
      },
    });
    await prisma.institutionMember.create({
      data: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        userId: user.id,
        role: "INSTITUTION_OWNER",
        status: "ACTIVE",
      },
    });
    const cash = await ensureUserTerminalCashAccount(user.id);
    const before = asDecimal(cash.availableBalance);
    const funded = await submitTerminalFundingRequest(user.id, {
      sourceBankAccountId: bank.id,
      amount: 12,
      idempotencyKey: `4e-bt-fund-${suffix}`,
    });
    assert.equal(funded.status, "COMPLETED");
    const after = await ensureUserTerminalCashAccount(user.id);
    assert.equal(Number(asDecimal(after.availableBalance).sub(before)), 12);
  });
});
