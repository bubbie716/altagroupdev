import type { AltaUser, CompanyRole } from "@/lib/auth/types";
import {
  canAccessBusinessModule,
  type BusinessAccountModule,
  type BusinessModuleAccess,
  getBusinessModuleAccess,
} from "@/lib/bank/business-account-access";
import type { BusinessTreasuryCompany } from "@/lib/bank/business-banking-types";
import { findCompanyMembership, canViewBusinessTreasury } from "@/lib/auth/permissions";
import { prisma } from "@/server/db";
import { mapTreasuryCompany } from "@/server/business-banking-mapper";
import { fromDbCompanyRole } from "@/server/enum-map";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

export type BusinessAccountContext = {
  accountId: string;
  companyId: string;
  companyName: string;
  role: CompanyRole;
  treasury: BusinessTreasuryCompany;
  moduleAccess: Record<BusinessAccountModule, BusinessModuleAccess>;
};

export async function resolveBusinessAccountContext(
  user: AltaUser,
  accountId: string,
  requiredModule?: BusinessAccountModule,
): Promise<BusinessAccountContext> {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: { company: true },
  });

  if (!account || account.accountType !== "BUSINESS_OPERATING") {
    badRequest("This page requires a Business Operating Account.");
  }
  if (!account.companyId || !account.company) notFound();

  const membership = findCompanyMembership(user, { companyId: account.companyId });
  if (!membership || !canViewBusinessTreasury(user, { companyId: account.companyId })) forbidden();

  if (account.company.verificationStatus !== "VERIFIED") {
    badRequest("Company must be verified to access business account features.");
  }

  const moduleAccess = {} as Record<BusinessAccountModule, BusinessModuleAccess>;
  for (const mod of [
    "overview",
    "activity",
    "payments",
    "payroll",
    "statements",
    "representatives",
    "settings",
  ] as BusinessAccountModule[]) {
    moduleAccess[mod] = getBusinessModuleAccess(membership.role, mod);
  }

  if (requiredModule && moduleAccess[requiredModule] === "none") {
    forbidden();
  }

  const treasury = mapTreasuryCompany(account.company, account, membership.role);

  return {
    accountId: account.id,
    companyId: account.companyId,
    companyName: account.company.name,
    role: membership.role,
    treasury,
    moduleAccess,
  };
}

export async function resolveOperatingAccountIdForCompany(
  user: AltaUser,
  companyId: string,
): Promise<string> {
  const membership = findCompanyMembership(user, { companyId });
  if (!membership || membership.role === "viewer") forbidden();

  const account = await prisma.bankAccount.findFirst({
    where: {
      companyId,
      accountType: "BUSINESS_OPERATING",
      status: "ACTIVE",
    },
  });
  if (!account) notFound();
  return account.id;
}

export async function assertBusinessAccountAccess(
  user: AltaUser,
  accountId: string,
  module: BusinessAccountModule,
): Promise<BusinessAccountContext> {
  const ctx = await resolveBusinessAccountContext(user, accountId, module);
  if (!canAccessBusinessModule(ctx.role, module)) forbidden();
  if (module === "payroll") {
    const { loadCommercialPlanSettings, canAccessCommercialPayroll } = await import(
      "@/server/commercial-plan.service"
    );
    const plan = await loadCommercialPlanSettings(ctx.companyId);
    if (!canAccessCommercialPayroll(plan)) forbidden();
  }
  return ctx;
}

export function mapMembershipRoleFromDb(role: import("@prisma/client").CompanyRole): CompanyRole {
  return fromDbCompanyRole(role);
}
