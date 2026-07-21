import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_EXCHANGE_INSTITUTION_ID,
  ALTA_EXCHANGE_PRIMARY_ROUTING_NUMBER,
  ALTA_TERMINAL_INSTITUTION_ID,
} from "@/lib/bank/account-ownership";
import { archivedLegalDocuments, getLegalDocument } from "@/lib/legal/legal-document-registry";
import { asDecimal } from "@/lib/ncc/ncc-money";
import {
  canInstitutionOriginateSettlement,
  canInstitutionReceiveSettlement,
  isRoutingNumberUsable,
} from "@/lib/ncc/ncc-permissions";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import {
  ensureAltaInstitutionsSeeded,
  retireAltaExchangeInstitution,
} from "@/server/ncc/ncc-institution.service";
import { NccSettlementError, submitInstruction } from "@/server/ncc/ncc-settlement.service";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";
const HISTORY_BALANCE = new Prisma.Decimal("12345.67");
const EXCHANGE_SETTLEMENT_ACCOUNT_ID = "sa-alta-exchange-flr-4g1-test";

describe("Sprint 4G Alta Exchange retirement (static)", () => {
  it("blocks TERMINATED institutions from originating or receiving settlement", () => {
    assert.equal(canInstitutionOriginateSettlement("TERMINATED"), false);
    assert.equal(canInstitutionOriginateSettlement("ACTIVE"), true);
    assert.equal(canInstitutionReceiveSettlement("TERMINATED"), false);
    assert.equal(canInstitutionReceiveSettlement("ACTIVE"), true);
  });

  it("archives Exchange legal docs while keeping Terminal customer agreement active", () => {
    assert.equal(getLegalDocument("AE-LEGAL-001")?.archived, undefined);
    for (const id of ["AE-LEGAL-002", "AE-LEGAL-003", "AE-LEGAL-004", "AE-LEGAL-005"]) {
      assert.equal(getLegalDocument(id)?.archived, true);
    }
    const archivedIds = archivedLegalDocuments().map((d) => d.id);
    assert.ok(archivedIds.includes("AE-LEGAL-002"));
    assert.equal(archivedIds.includes("AE-LEGAL-001"), false);
  });
});

describe("Sprint 4G.1 Alta Exchange retirement (behavioral)", {
  skip: !RUN || !isDatabaseConfigured(),
}, () => {
  const suffix = Date.now().toString(36);
  let actorUserId = "";
  let auditLogId = "";
  let exchangeRoutingId = "";
  let bankRoutingId = "";
  let terminalRoutingId = "";

  before(async () => {
    await ensureAltaInstitutionsSeeded();

    const user = await prisma.user.create({
      data: {
        discordId: `ncc-4g1-${suffix}`,
        discordUsername: `ncc_4g1_${suffix}`,
      },
    });
    actorUserId = user.id;

    await prisma.financialInstitution.upsert({
      where: { id: ALTA_EXCHANGE_INSTITUTION_ID },
      create: {
        id: ALTA_EXCHANGE_INSTITUTION_ID,
        legalName: "Alta Exchange N.V.",
        displayName: "Alta Exchange",
        slug: "alta-exchange",
        routingPrefix: "013",
        institutionType: "EXCHANGE",
        status: "ACTIVE",
        isAlta: true,
        isNCCParticipant: true,
        approvedAt: new Date(),
      },
      update: {
        status: "ACTIVE",
        isNCCParticipant: true,
        terminatedAt: null,
        suspendedAt: null,
        legalName: "Alta Exchange N.V.",
        displayName: "Alta Exchange",
        slug: "alta-exchange",
      },
    });

    const routing = await prisma.routingNumber.upsert({
      where: { routingNumber: ALTA_EXCHANGE_PRIMARY_ROUTING_NUMBER },
      create: {
        routingNumber: ALTA_EXCHANGE_PRIMARY_ROUTING_NUMBER,
        institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
        status: "ACTIVE",
        isPrimary: true,
        label: "Alta Exchange Primary Routing",
        activatedAt: new Date(),
        deactivatedAt: null,
      },
      update: {
        institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
        status: "ACTIVE",
        isPrimary: true,
        deactivatedAt: null,
        activatedAt: new Date(),
      },
    });
    exchangeRoutingId = routing.id;

    await prisma.settlementAccount.upsert({
      where: {
        institutionId_currency: {
          institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
          currency: "FLR",
        },
      },
      create: {
        id: EXCHANGE_SETTLEMENT_ACCOUNT_ID,
        institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
        currency: "FLR",
        ledgerBalance: HISTORY_BALANCE,
        availableBalance: HISTORY_BALANCE,
        status: "ACTIVE",
        frozenAt: null,
        frozenReason: null,
      },
      update: {
        ledgerBalance: HISTORY_BALANCE,
        availableBalance: HISTORY_BALANCE,
        status: "ACTIVE",
        frozenAt: null,
        frozenReason: null,
      },
    });

    const audit = await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "NCC_TEST_EXCHANGE_HISTORY",
        entityType: "FINANCIAL_INSTITUTION",
        entityId: ALTA_EXCHANGE_INSTITUTION_ID,
        description: `4G.1 preexisting history ${suffix}`,
        institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
      },
    });
    auditLogId = audit.id;

    const bankRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_BANK_INSTITUTION_ID, isPrimary: true },
    });
    bankRoutingId = bankRouting.id;
    const terminalRouting = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId: ALTA_TERMINAL_INSTITUTION_ID, isPrimary: true },
    });
    terminalRoutingId = terminalRouting.id;
  });

  after(async () => {
    // Leave the Exchange institution retired (production-correct). Remove only this test's audit row.
    if (auditLogId) {
      await prisma.auditLog.deleteMany({ where: { id: auditLogId } }).catch(() => undefined);
    }
    if (actorUserId) {
      await prisma.user.delete({ where: { id: actorUserId } }).catch(() => undefined);
    }
  });

  it("retires Exchange idempotently without changing balances or timestamps on re-run", async () => {
    await retireAltaExchangeInstitution();

    const afterFirst = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: ALTA_EXCHANGE_INSTITUTION_ID },
    });
    assert.equal(afterFirst.status, "TERMINATED");
    assert.equal(afterFirst.isNCCParticipant, false);
    assert.ok(afterFirst.terminatedAt);
    assert.ok(afterFirst.suspendedAt);
    const terminatedAt = afterFirst.terminatedAt.toISOString();
    const suspendedAt = afterFirst.suspendedAt.toISOString();

    const routing = await prisma.routingNumber.findUniqueOrThrow({
      where: { id: exchangeRoutingId },
    });
    assert.equal(isRoutingNumberUsable(routing.status), false);
    assert.ok(
      routing.status === "SUSPENDED" ||
        routing.status === "RETIRED" ||
        routing.status === "INACTIVE",
    );
    assert.ok(routing.deactivatedAt);
    const deactivatedAt = routing.deactivatedAt.toISOString();

    const account = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
          currency: "FLR",
        },
      },
    });
    assert.equal(account.status, "FROZEN");
    assert.ok(account.frozenAt);
    assert.equal(asDecimal(account.ledgerBalance).toFixed(2), HISTORY_BALANCE.toFixed(2));
    assert.equal(asDecimal(account.availableBalance).toFixed(2), HISTORY_BALANCE.toFixed(2));
    const frozenAt = account.frozenAt.toISOString();

    const history = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
    assert.ok(history);
    assert.equal(history.institutionId, ALTA_EXCHANGE_INSTITUTION_ID);

    const adapter = await getAdapterForInstitution({
      id: ALTA_EXCHANGE_INSTITUTION_ID,
      slug: "alta-exchange",
      isAlta: true,
    });
    assert.equal(adapter, null);

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_EXCHANGE_INSTITUTION_ID,
          receivingInstitutionId: ALTA_TERMINAL_INSTITUTION_ID,
          sendingRoutingNumberId: exchangeRoutingId,
          receivingRoutingNumberId: terminalRoutingId,
          amount: 1,
          currency: "FLR",
          idempotencyKey: `4g1-from-ex-${suffix}`,
          submittedByUserId: actorUserId,
        }),
      (error: unknown) =>
        error instanceof NccSettlementError &&
        (error.code === "INSTITUTION_CANNOT_ORIGINATE" ||
          error.code === "INSTITUTION_NOT_NCC_PARTICIPANT" ||
          error.code === "ROUTING_NUMBER_UNAVAILABLE"),
    );

    await assert.rejects(
      () =>
        submitInstruction({
          sendingInstitutionId: ALTA_BANK_INSTITUTION_ID,
          receivingInstitutionId: ALTA_EXCHANGE_INSTITUTION_ID,
          sendingRoutingNumberId: bankRoutingId,
          receivingRoutingNumberId: exchangeRoutingId,
          amount: 1,
          currency: "FLR",
          idempotencyKey: `4g1-to-ex-${suffix}`,
          submittedByUserId: actorUserId,
        }),
      (error: unknown) =>
        error instanceof NccSettlementError &&
        (error.code === "INSTITUTION_CANNOT_RECEIVE" ||
          error.code === "INSTITUTION_NOT_NCC_PARTICIPANT" ||
          error.code === "ROUTING_NUMBER_UNAVAILABLE"),
    );

    // Confirm no settlement instructions were created for the rejected attempts.
    const leaked = await prisma.settlementInstruction.count({
      where: {
        OR: [
          { sendingInstitutionId: ALTA_EXCHANGE_INSTITUTION_ID, idempotencyKey: `4g1-from-ex-${suffix}` },
          { receivingInstitutionId: ALTA_EXCHANGE_INSTITUTION_ID, idempotencyKey: `4g1-to-ex-${suffix}` },
        ],
      },
    });
    assert.equal(leaked, 0);

    await retireAltaExchangeInstitution();

    const afterSecond = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: ALTA_EXCHANGE_INSTITUTION_ID },
    });
    assert.equal(afterSecond.terminatedAt?.toISOString(), terminatedAt);
    assert.equal(afterSecond.suspendedAt?.toISOString(), suspendedAt);
    assert.equal(afterSecond.status, "TERMINATED");
    assert.equal(afterSecond.isNCCParticipant, false);

    const routingSecond = await prisma.routingNumber.findUniqueOrThrow({
      where: { id: exchangeRoutingId },
    });
    assert.equal(routingSecond.deactivatedAt?.toISOString(), deactivatedAt);

    const accountSecond = await prisma.settlementAccount.findUniqueOrThrow({
      where: {
        institutionId_currency: {
          institutionId: ALTA_EXCHANGE_INSTITUTION_ID,
          currency: "FLR",
        },
      },
    });
    assert.equal(accountSecond.frozenAt?.toISOString(), frozenAt);
    assert.equal(asDecimal(accountSecond.ledgerBalance).toFixed(2), HISTORY_BALANCE.toFixed(2));
    assert.equal(asDecimal(accountSecond.availableBalance).toFixed(2), HISTORY_BALANCE.toFixed(2));
  });
});
