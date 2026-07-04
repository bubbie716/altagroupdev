import { prisma } from "@/server/db";
import {
  ALTA_BANK_INSTITUTION_ID,
  ALTA_BANK_PRIMARY_ROUTING_NUMBER,
} from "@/lib/bank/account-ownership";

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
      financialInstitution: { isAlta: true, status: "ACTIVE" },
    },
  });
  return row?.routingNumber ?? null;
}

export async function ensureAltaBankInstitutionSeeded(): Promise<void> {
  await prisma.financialInstitution.upsert({
    where: { id: ALTA_BANK_INSTITUTION_ID },
    create: {
      id: ALTA_BANK_INSTITUTION_ID,
      name: "Alta Bank",
      shortName: "Alta",
      routingPrefix: "AB",
      institutionType: "BANK",
      status: "ACTIVE",
      isAlta: true,
      isNCCParticipant: false,
    },
    update: {
      name: "Alta Bank",
      shortName: "Alta",
      routingPrefix: "AB",
      status: "ACTIVE",
      isAlta: true,
    },
  });

  await prisma.routingNumber.upsert({
    where: { routingNumber: ALTA_BANK_PRIMARY_ROUTING_NUMBER },
    create: {
      id: "rn-alta-primary",
      routingNumber: ALTA_BANK_PRIMARY_ROUTING_NUMBER,
      financialInstitutionId: ALTA_BANK_INSTITUTION_ID,
      status: "ACTIVE",
      label: "Alta Bank Primary Routing",
    },
    update: {
      status: "ACTIVE",
      financialInstitutionId: ALTA_BANK_INSTITUTION_ID,
    },
  });
}

export async function listActiveFinancialInstitutions() {
  return prisma.financialInstitution.findMany({
    where: { status: "ACTIVE" },
    include: { routingNumbers: { where: { status: "ACTIVE" } } },
    orderBy: [{ isAlta: "desc" }, { name: "asc" }],
  });
}
