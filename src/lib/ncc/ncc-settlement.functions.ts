import { createServerFn } from "@tanstack/react-start";
import type { FinancialInstitutionType, InstitutionMemberRole } from "@prisma/client";

function serializeInstitution(row: {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  institutionType: string;
  status: string;
  description: string | null;
  websiteUrl: string | null;
  isAlta: boolean;
  isNCCParticipant: boolean;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
}) {
  return {
    id: row.id,
    legalName: row.legalName,
    displayName: row.displayName,
    slug: row.slug,
    institutionType: row.institutionType,
    status: row.status,
    description: row.description,
    websiteUrl: row.websiteUrl,
    isAlta: row.isAlta,
    isNCCParticipant: row.isNCCParticipant,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

function serializeSettlementAccount(row: {
  id: string;
  institutionId: string;
  currency: string;
  ledgerBalance: { toString(): string };
  availableBalance: { toString(): string };
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    institutionId: row.institutionId,
    currency: row.currency,
    ledgerBalance: Number(row.ledgerBalance.toString()),
    availableBalance: Number(row.availableBalance.toString()),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const nccCreateInstitution = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      legalName: string;
      displayName: string;
      slug?: string;
      institutionType: FinancialInstitutionType;
      description?: string;
      websiteUrl?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { createInstitution } = await import("@/server/ncc/ncc-admin.service");
    return serializeInstitution(await createInstitution(data));
  });

/** @deprecated Sprint 4F — direct activation bypass removed. */
export const nccApproveInstitution = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { approveInstitution } = await import("@/server/ncc/ncc-admin.service");
    await approveInstitution(data.institutionId);
    return serializeInstitution(
      await (
        await import("@/server/db")
      ).prisma.financialInstitution.findUniqueOrThrow({ where: { id: data.institutionId } }),
    );
  });

export const nccAssignRoutingNumber = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId: string;
      routingNumber?: string;
      isPrimary?: boolean;
      label?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assignRoutingNumber } = await import("@/server/ncc/ncc-admin.service");
    const row = await assignRoutingNumber(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      routingNumber: row.routingNumber,
      status: row.status,
      isPrimary: row.isPrimary,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      activatedAt: row.activatedAt?.toISOString() ?? null,
    };
  });

export const nccAdjustSettlementAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { settlementAccountId: string; amount: number; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    const { adjustSettlementAccount } = await import("@/server/ncc/ncc-admin.service");
    return serializeSettlementAccount(await adjustSettlementAccount(data));
  });

export const nccAddInstitutionMember = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { institutionId: string; userId: string; role: InstitutionMemberRole }) => input,
  )
  .handler(async ({ data }) => {
    const { addInstitutionMember } = await import("@/server/ncc/ncc-admin.service");
    const row = await addInstitutionMember(data);
    return {
      id: row.id,
      institutionId: row.institutionId,
      userId: row.userId,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  });

export const nccGetInstitutionOverview = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string }) => input)
  .handler(async ({ data }) => {
    const { getInstitutionOverview } = await import("@/server/ncc/ncc-institution.service");
    const row = await getInstitutionOverview(data.institutionId);
    return {
      ...serializeInstitution(row),
      routingNumbers: row.routingNumbers.map((rn) => ({
        id: rn.id,
        routingNumber: rn.routingNumber,
        status: rn.status,
        isPrimary: rn.isPrimary,
        label: rn.label,
      })),
      settlementAccounts: row.settlementAccounts.map(serializeSettlementAccount),
      counts: row._count,
    };
  });

export const nccSubmitSettlement = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      institutionId: string;
      receivingInstitutionId: string;
      sendingRoutingNumberId: string;
      receivingRoutingNumberId: string;
      amount: number;
      currency?: string;
      purpose?: string;
      externalReference?: string;
      idempotencyKey: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { submitInstitutionSettlement } = await import("@/server/ncc/ncc-institution.service");
    const { institutionId, ...rest } = data;
    return submitInstitutionSettlement(institutionId, rest);
  });

export const nccGetInstruction = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string; instructionId: string }) => input)
  .handler(async ({ data }) => {
    const { getInstitutionInstruction } = await import("@/server/ncc/ncc-institution.service");
    return getInstitutionInstruction(data.institutionId, data.instructionId);
  });

export const nccListInstructions = createServerFn({ method: "GET" })
  .inputValidator((input: { institutionId: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    const { listInstitutionInstructions } = await import("@/server/ncc/ncc-institution.service");
    return listInstitutionInstructions(data.institutionId, { limit: data.limit });
  });

export const nccCancelInstruction = createServerFn({ method: "POST" })
  .inputValidator((input: { institutionId: string; instructionId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const { cancelInstitutionInstruction } = await import("@/server/ncc/ncc-institution.service");
    return cancelInstitutionInstruction(data.institutionId, data.instructionId, data.reason);
  });
