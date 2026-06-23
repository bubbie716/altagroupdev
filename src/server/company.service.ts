import type { CompanyRole } from "@/lib/auth/types";
import type {
  AddMemberInput,
  CompanyDetail,
  CompanySummary,
  CreateCompanyInput,
  InternalCompanyRow,
  RemoveMemberInput,
  UpdateCompanySettingsInput,
  UpdateMemberRoleInput,
} from "@/lib/company/types";
import { prisma } from "@/server/db";
import { requireAuth } from "@/server/auth.service";
import {
  mapCompanyDetail,
  mapCompanySummary,
  mapInternalCompanyRow,
  toDbCompanyType,
  toDbMemberRole,
} from "@/server/company-mapper";
import { fromDbCompanyRole } from "@/server/enum-map";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

async function requireMembership(companyId: string, userId: string) {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!membership) forbidden();
  return membership;
}

function canManageMembers(role: CompanyRole): boolean {
  return role === "owner" || role === "executive";
}

const companyWithMembersInclude = {
  memberships: {
    include: { user: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export async function listUserCompanies(userId: string): Promise<CompanySummary[]> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId },
    include: { company: true },
    orderBy: { company: { name: "asc" } },
  });

  return memberships.map((m) => mapCompanySummary(m.company, fromDbCompanyRole(m.role)));
}

export async function getCompanyDetailForUser(
  companyId: string,
  userId: string,
): Promise<CompanyDetail> {
  const membership = await requireMembership(companyId, userId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: companyWithMembersInclude,
  });
  if (!company) notFound();
  return mapCompanyDetail(company, userId, fromDbCompanyRole(membership.role));
}

export async function createCompany(
  userId: string,
  input: CreateCompanyInput,
): Promise<{ companyId: string }> {
  const desiredTicker = input.desiredTicker?.trim().toUpperCase() || null;

  const company = await prisma.company.create({
    data: {
      name: input.name.trim(),
      type: toDbCompanyType(input.type),
      sector: input.sector.trim(),
      desiredTicker,
      description: input.description.trim(),
      headquarters: input.headquarters?.trim() || null,
      primaryContactDiscordUsername: input.primaryContactDiscordUsername.trim(),
      intendedUses: input.intendedUses,
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      memberships: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return { companyId: company.id };
}

export async function updateCompanySettings(
  userId: string,
  input: UpdateCompanySettingsInput,
): Promise<{ companyId: string }> {
  const membership = await requireMembership(input.companyId, userId);
  if (fromDbCompanyRole(membership.role) !== "owner") forbidden();

  const existing = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!existing) notFound();

  const desiredTicker =
    existing.ticker === null
      ? input.desiredTicker?.trim().toUpperCase() || null
      : existing.desiredTicker;

  await prisma.company.update({
    where: { id: input.companyId },
    data: {
      name: input.name.trim(),
      sector: input.sector.trim(),
      description: input.description.trim(),
      headquarters: input.headquarters?.trim() || null,
      desiredTicker,
    },
  });

  return { companyId: input.companyId };
}

export async function updateMemberRole(
  actorUserId: string,
  input: UpdateMemberRoleInput,
): Promise<void> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();

  const target = await prisma.companyMembership.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
  });
  if (!target) notFound();

  const targetRole = fromDbCompanyRole(target.role);
  const nextRole = input.role;

  if (actorRole === "executive") {
    if (targetRole === "owner" || nextRole === "owner") forbidden();
  }

  if (targetRole === "owner" && nextRole !== "owner") {
    const ownerCount = await prisma.companyMembership.count({
      where: { companyId: input.companyId, role: "OWNER" },
    });
    if (ownerCount <= 1) forbidden();
  }

  await prisma.companyMembership.update({
    where: { id: input.membershipId },
    data: { role: toDbMemberRole(nextRole) },
  });
}

export async function removeMember(actorUserId: string, input: RemoveMemberInput): Promise<void> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();

  const target = await prisma.companyMembership.findFirst({
    where: { id: input.membershipId, companyId: input.companyId },
  });
  if (!target) notFound();

  const targetRole = fromDbCompanyRole(target.role);

  if (actorRole === "executive" && targetRole === "owner") forbidden();

  if (targetRole === "owner") {
    const ownerCount = await prisma.companyMembership.count({
      where: { companyId: input.companyId, role: "OWNER" },
    });
    if (ownerCount <= 1) forbidden();
  }

  await prisma.companyMembership.delete({ where: { id: input.membershipId } });
}

export async function addMemberByDiscord(
  actorUserId: string,
  input: AddMemberInput,
): Promise<{ added: boolean; username: string }> {
  const actorMembership = await requireMembership(input.companyId, actorUserId);
  const actorRole = fromDbCompanyRole(actorMembership.role);
  if (!canManageMembers(actorRole)) forbidden();
  if (actorRole === "executive" && input.role === "owner") forbidden();

  const identifier = input.discordIdentifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ discordId: identifier }, { discordUsername: { equals: identifier, mode: "insensitive" } }],
    },
  });
  if (!user) notFound();

  const existing = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: input.companyId } },
  });
  if (existing) {
    throw new Error("ALREADY_MEMBER");
  }

  await prisma.companyMembership.create({
    data: {
      userId: user.id,
      companyId: input.companyId,
      role: toDbMemberRole(input.role),
    },
  });

  return { added: true, username: user.discordUsername };
}

export async function listInternalCompanies(): Promise<InternalCompanyRow[]> {
  await requireAuth();
  const companies = await prisma.company.findMany({
    include: { _count: { select: { memberships: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return companies.map(mapInternalCompanyRow);
}

export async function getInternalCompanyDetail(companyId: string) {
  await requireAuth();
  return prisma.company.findUnique({
    where: { id: companyId },
    include: companyWithMembersInclude,
  });
}
