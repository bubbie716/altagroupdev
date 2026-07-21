import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_BANK_PRIMARY_ROUTING_NUMBER,
  ALTA_EXCHANGE_INSTITUTION_ID,
  ALTA_TERMINAL_INSTITUTION_ID,
  ALTA_TERMINAL_PRIMARY_ROUTING_NUMBER,
} from "@/lib/bank/account-ownership";
import { asDecimal, NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import { requireInstitutionPermission, requireNccStaff } from "@/server/ncc/ncc-permissions.service";
import {
  cancelInstruction,
  getInstruction,
  submitInstruction,
  type SubmitSettlementInstructionInput,
} from "@/server/ncc/ncc-settlement.service";

const LEGACY_CREATE_TIME_FLOAT = new Prisma.Decimal("1000000000.00");

export async function getInstitutionOverview(institutionId: string) {
  await requireInstitutionPermission(institutionId, "view_institution");
  return prisma.financialInstitution.findUniqueOrThrow({
    where: { id: institutionId },
    include: {
      routingNumbers: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      settlementAccounts: true,
      _count: { select: { members: true, sentInstructions: true, receivedInstructions: true } },
    },
  });
}

export async function listInstitutionRoutingNumbers(institutionId: string) {
  await requireInstitutionPermission(institutionId, "view_routing_numbers");
  return prisma.routingNumber.findMany({
    where: { institutionId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function getSettlementAccountSummary(institutionId: string, currency = NCC_DEFAULT_CURRENCY) {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  return prisma.settlementAccount.findUnique({
    where: {
      institutionId_currency: { institutionId, currency: currency.toUpperCase() },
    },
  });
}

export async function submitInstitutionSettlement(
  institutionId: string,
  input: Omit<SubmitSettlementInstructionInput, "sendingInstitutionId" | "submittedByUserId">,
) {
  const { user } = await requireInstitutionPermission(institutionId, "submit_settlement");
  if (input.receivingInstitutionId === institutionId) {
    throw new Error("SELF_SETTLEMENT_DENIED");
  }
  return submitInstruction({
    ...input,
    sendingInstitutionId: institutionId,
    submittedByUserId: user.id,
  });
}

export async function getInstitutionInstruction(institutionId: string, instructionId: string) {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const instruction = await getInstruction(instructionId);
  if (
    instruction.sendingInstitutionId !== institutionId &&
    instruction.receivingInstitutionId !== institutionId
  ) {
    throw new Error("FORBIDDEN");
  }
  return instruction;
}

export async function listInstitutionInstructions(
  institutionId: string,
  options?: { limit?: number },
) {
  await requireInstitutionPermission(institutionId, "view_settlement_accounts");
  const rows = await prisma.settlementInstruction.findMany({
    where: {
      OR: [{ sendingInstitutionId: institutionId }, { receivingInstitutionId: institutionId }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(options?.limit ?? 50, 100),
  });
  return rows.map((row) => ({
    id: row.id,
    publicReference: row.publicReference,
    status: row.status,
    amount: Number(row.amount.toString()),
    currency: row.currency,
    sendingInstitutionId: row.sendingInstitutionId,
    receivingInstitutionId: row.receivingInstitutionId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function cancelInstitutionInstruction(
  institutionId: string,
  instructionId: string,
  reason: string,
) {
  const { user } = await requireInstitutionPermission(institutionId, "cancel_settlement");
  const instruction = await getInstruction(instructionId);
  if (instruction.sendingInstitutionId !== institutionId) {
    throw new Error("FORBIDDEN");
  }
  return cancelInstruction(instructionId, user.id, reason);
}

/** New settlement accounts always start at zero — liquidity requires authorized dual-control ops. */
const ZERO_SETTLEMENT_BALANCE = 0;

/**
 * Test-only top-up so Bank↔Terminal suites remain runnable after create-time float removal.
 * Never runs outside NCC_SETTLEMENT_TESTS; never used for production funding.
 * Only funds never-used zero accounts — re-seed must not overwrite spent balances
 * (Sprint 3a.1 hardening: seed never rewrites ledgerBalance / availableBalance).
 */
async function ensureAltaSettlementTestLiquidity(): Promise<void> {
  if (process.env.NCC_SETTLEMENT_TESTS !== "1") return;
  const target = new Prisma.Decimal("10000000.00");
  // Bank + Terminal only — Alta Exchange is retired and must not receive test liquidity.
  const accounts = await prisma.settlementAccount.findMany({
    where: {
      institutionId: {
        in: [ALTA_BANK_INSTITUTION_ID, ALTA_TERMINAL_INSTITUTION_ID],
      },
      currency: NCC_DEFAULT_CURRENCY,
    },
  });
  for (const account of accounts) {
    const ledger = asDecimal(account.ledgerBalance);
    const available = asDecimal(account.availableBalance);
    if (!ledger.eq(0) || !available.eq(0)) continue;
    await prisma.settlementAccount.update({
      where: { id: account.id },
      data: {
        ledgerBalance: target,
        availableBalance: target,
      },
    });
  }
}

/**
 * Detects exact legacy 1B create-time floats and marks them for review.
 * Does not alter balances.
 */
export async function markLegacyCreateTimeFloatsForReview(): Promise<number> {
  const result = await prisma.settlementAccount.updateMany({
    where: {
      ledgerBalance: LEGACY_CREATE_TIME_FLOAT,
      availableBalance: LEGACY_CREATE_TIME_FLOAT,
      legacyFloatReviewStatus: "NONE",
    },
    data: { legacyFloatReviewStatus: "REQUIRES_REVIEW" },
  });
  return result.count;
}

export async function countUnexplainedLegacyFloats(): Promise<number> {
  return prisma.settlementAccount.count({
    where: { legacyFloatReviewStatus: "REQUIRES_REVIEW" },
  });
}

export async function ensureAltaBankInstitutionSeeded(): Promise<void> {
  await prisma.financialInstitution.upsert({
    where: { id: ALTA_BANK_INSTITUTION_ID },
    create: {
      id: ALTA_BANK_INSTITUTION_ID,
      legalName: "Alta Bank N.V.",
      displayName: "Alta Bank",
      slug: "alta-bank",
      routingPrefix: "011",
      institutionType: "BANK",
      status: "ACTIVE",
      isAlta: true,
      isNCCParticipant: true,
      approvedAt: new Date(),
    },
    update: {
      legalName: "Alta Bank N.V.",
      displayName: "Alta Bank",
      slug: "alta-bank",
      routingPrefix: "011",
      status: "ACTIVE",
      isAlta: true,
      isNCCParticipant: true,
      approvedAt: new Date(),
    },
  });

  await prisma.routingNumber.upsert({
    where: { routingNumber: ALTA_BANK_PRIMARY_ROUTING_NUMBER },
    create: {
      id: "rn-alta-primary",
      routingNumber: ALTA_BANK_PRIMARY_ROUTING_NUMBER,
      institutionId: ALTA_BANK_INSTITUTION_ID,
      status: "ACTIVE",
      isPrimary: true,
      label: "Alta Bank Primary Routing",
      activatedAt: new Date(),
    },
    update: {
      status: "ACTIVE",
      institutionId: ALTA_BANK_INSTITUTION_ID,
      isPrimary: true,
      activatedAt: new Date(),
    },
  });

  await prisma.settlementAccount.upsert({
    where: {
      institutionId_currency: {
        institutionId: ALTA_BANK_INSTITUTION_ID,
        currency: NCC_DEFAULT_CURRENCY,
      },
    },
    create: {
      id: "sa-alta-bank-flr",
      institutionId: ALTA_BANK_INSTITUTION_ID,
      currency: NCC_DEFAULT_CURRENCY,
      ledgerBalance: ZERO_SETTLEMENT_BALANCE,
      availableBalance: ZERO_SETTLEMENT_BALANCE,
      status: "ACTIVE",
    },
    // Metadata-only update — never rewrite ledgerBalance / availableBalance.
    update: {
      status: "ACTIVE",
    },
  });
}

async function ensureAltaInternalInstitutionSeeded(input: {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  routingPrefix: string;
  institutionType: "EXCHANGE" | "BROKERAGE" | "OTHER";
  primaryRoutingNumber: string;
  settlementAccountId: string;
}): Promise<void> {
  await prisma.financialInstitution.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      legalName: input.legalName,
      displayName: input.displayName,
      slug: input.slug,
      routingPrefix: input.routingPrefix,
      institutionType: input.institutionType,
      status: "ACTIVE",
      isAlta: true,
      isNCCParticipant: true,
      approvedAt: new Date(),
    },
    update: {
      legalName: input.legalName,
      displayName: input.displayName,
      slug: input.slug,
      routingPrefix: input.routingPrefix,
      status: "ACTIVE",
      isAlta: true,
      isNCCParticipant: true,
      approvedAt: new Date(),
    },
  });

  await prisma.routingNumber.upsert({
    where: { routingNumber: input.primaryRoutingNumber },
    create: {
      routingNumber: input.primaryRoutingNumber,
      institutionId: input.id,
      status: "ACTIVE",
      isPrimary: true,
      label: `${input.displayName} Primary Routing`,
      activatedAt: new Date(),
    },
    update: {
      status: "ACTIVE",
      institutionId: input.id,
      isPrimary: true,
      activatedAt: new Date(),
    },
  });

  await prisma.settlementAccount.upsert({
    where: {
      institutionId_currency: {
        institutionId: input.id,
        currency: NCC_DEFAULT_CURRENCY,
      },
    },
    create: {
      id: input.settlementAccountId,
      institutionId: input.id,
      currency: NCC_DEFAULT_CURRENCY,
      ledgerBalance: ZERO_SETTLEMENT_BALANCE,
      availableBalance: ZERO_SETTLEMENT_BALANCE,
      status: "ACTIVE",
    },
    // Metadata-only update — never rewrite balances after create.
    update: {
      status: "ACTIVE",
    },
  });
}

/**
 * Retires Alta Exchange as an NCC participant without deleting history.
 * Atomic, idempotent — safe to run repeatedly. Never rewrites balances or
 * replaces existing retirement timestamps.
 */
export async function retireAltaExchangeInstitution(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialInstitution.findUnique({
      where: { id: ALTA_EXCHANGE_INSTITUTION_ID },
      select: {
        id: true,
        terminatedAt: true,
        suspendedAt: true,
      },
    });
    if (!existing) return;

    const now = new Date();

    await tx.financialInstitution.update({
      where: { id: ALTA_EXCHANGE_INSTITUTION_ID },
      data: {
        status: "TERMINATED",
        isNCCParticipant: false,
        terminatedAt: existing.terminatedAt ?? now,
        suspendedAt: existing.suspendedAt ?? now,
      },
    });

    const routings = await tx.routingNumber.findMany({
      where: { institutionId: ALTA_EXCHANGE_INSTITUTION_ID },
      select: { id: true, status: true, deactivatedAt: true },
    });
    for (const routing of routings) {
      if (
        routing.status === "SUSPENDED" ||
        routing.status === "RETIRED" ||
        routing.status === "INACTIVE"
      ) {
        continue;
      }
      await tx.routingNumber.update({
        where: { id: routing.id },
        data: {
          status: "SUSPENDED",
          deactivatedAt: routing.deactivatedAt ?? now,
        },
      });
    }

    const accounts = await tx.settlementAccount.findMany({
      where: { institutionId: ALTA_EXCHANGE_INSTITUTION_ID },
      select: {
        id: true,
        status: true,
        frozenAt: true,
        frozenReason: true,
      },
    });
    for (const account of accounts) {
      if (account.status === "FROZEN") continue;
      await tx.settlementAccount.update({
        where: { id: account.id },
        data: {
          status: "FROZEN",
          frozenAt: account.frozenAt ?? now,
          frozenReason:
            account.frozenReason ?? "Alta Exchange retired — Sprint 4G legal archival",
          // ledgerBalance / availableBalance intentionally omitted
        },
      });
    }
  });
}

/**
 * Seeds Alta Bank and Alta Terminal as ACTIVE NCC participants with routing
 * numbers and zero-balance settlement accounts. Alta Exchange is retired
 * (TERMINATED) when present — never re-seeded or reactivated as ACTIVE.
 *
 * Liquidity must be applied through authorized dual-control liquidity operations.
 * Re-running this seed never overwrites existing ledgerBalance / availableBalance.
 */
export async function ensureAltaInstitutionsSeeded(): Promise<void> {
  await ensureAltaBankInstitutionSeeded();
  await ensureAltaInternalInstitutionSeeded({
    id: ALTA_TERMINAL_INSTITUTION_ID,
    legalName: "Alta Terminal LLC",
    displayName: "Alta Terminal",
    slug: "alta-terminal",
    routingPrefix: "012",
    institutionType: "BROKERAGE",
    primaryRoutingNumber: ALTA_TERMINAL_PRIMARY_ROUTING_NUMBER,
    settlementAccountId: "sa-alta-terminal-flr",
  });
  await retireAltaExchangeInstitution();
  await markLegacyCreateTimeFloatsForReview();
  await ensureAltaSettlementTestLiquidity();
}

/** Resolves an Alta-internal institution's id + primary ACTIVE routing number id. */
export async function getInstitutionPrimaryRouting(
  institutionId: string,
): Promise<{ institutionId: string; routingNumberId: string } | null> {
  const routing = await prisma.routingNumber.findFirst({
    where: { institutionId, isPrimary: true, status: "ACTIVE" },
  });
  if (!routing) return null;
  return { institutionId, routingNumberId: routing.id };
}

export async function listActiveFinancialInstitutions() {
  await requireNccStaff();
  return prisma.financialInstitution.findMany({
    where: { status: "ACTIVE" },
    include: { routingNumbers: { where: { status: "ACTIVE" } } },
    orderBy: [{ isAlta: "desc" }, { displayName: "asc" }],
  });
}

export async function getAltaBankInstitution() {
  return prisma.financialInstitution.findFirst({
    where: { isAlta: true, status: "ACTIVE" },
    include: { routingNumbers: { where: { status: "ACTIVE" } } },
  });
}

export async function getAltaBankPrimaryRoutingNumber(): Promise<string | null> {
  const row = await prisma.routingNumber.findFirst({
    where: {
      routingNumber: ALTA_BANK_PRIMARY_ROUTING_NUMBER,
      status: "ACTIVE",
      institution: { isAlta: true, status: "ACTIVE" },
    },
  });
  return row?.routingNumber ?? null;
}
