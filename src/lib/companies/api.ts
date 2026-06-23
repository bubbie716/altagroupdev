/**
 * Server-side company API.
 *
 * Use from server functions, loaders, and services — not directly from client components.
 * Client code should call `src/lib/company/company.functions.ts` (TanStack Start RPC).
 */
import type { CompanyRole } from "@/lib/auth/types";
import type {
  CompanyDetail,
  CompanyMember,
  CompanySummary,
  CreateCompanyInput,
  UpdateCompanySettingsInput,
} from "@/lib/company/types";
import { prisma } from "@/server/db";
import { fromDbCompanyRole } from "@/server/enum-map";
import {
  addMember,
  createCompany,
  getCompanyDetailForUser,
  getCompanyMembers,
  listUserCompanies,
  removeMember,
  updateCompanySettings,
  updateMemberRole,
} from "@/server/company.service";

export {
  listUserCompanies as getUserCompanies,
  getCompanyDetailForUser as getCompanyById,
  createCompany,
  getCompanyMembers,
};

export async function updateCompany(
  companyId: string,
  actorUserId: string,
  input: Omit<UpdateCompanySettingsInput, "companyId">,
): Promise<{ companyId: string }> {
  return updateCompanySettings(actorUserId, { ...input, companyId });
}

export async function addCompanyMember(
  companyId: string,
  targetUserId: string,
  role: CompanyRole,
  actorUserId: string,
): Promise<void> {
  return addMember(actorUserId, companyId, targetUserId, role);
}

export async function updateCompanyMemberRole(
  companyId: string,
  membershipId: string,
  role: CompanyRole,
  actorUserId: string,
): Promise<void> {
  return updateMemberRole(actorUserId, { companyId, membershipId, role });
}

export async function removeCompanyMember(
  companyId: string,
  membershipId: string,
  actorUserId: string,
): Promise<void> {
  return removeMember(actorUserId, { companyId, membershipId });
}

async function membershipRole(userId: string, companyId: string): Promise<CompanyRole | null> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return membership ? fromDbCompanyRole(membership.role) : null;
}

export async function userCanViewCompany(userId: string, companyId: string): Promise<boolean> {
  return (await membershipRole(userId, companyId)) !== null;
}

export async function userCanManageCompany(userId: string, companyId: string): Promise<boolean> {
  const role = await membershipRole(userId, companyId);
  return role === "owner" || role === "executive";
}

export async function userCanEditCompanySettings(
  userId: string,
  companyId: string,
): Promise<boolean> {
  const role = await membershipRole(userId, companyId);
  return role === "owner";
}

export type { CompanyDetail, CompanyMember, CompanySummary, CreateCompanyInput };
