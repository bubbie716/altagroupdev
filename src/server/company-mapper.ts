import type { CompanyRole } from "@prisma/client";
import type {
  CompanyDetail,
  CompanyMember,
  CompanySummary,
  CompanyTypeValue,
  IntendedUseValue,
  InternalCompanyRow,
} from "@/lib/company/types";
import type { CompanyRole as AppCompanyRole } from "@/lib/auth/types";
import {
  formatDbCompanyStatus,
  formatDbCompanyType,
  formatDbVerificationStatus,
  fromDbAccountStatus,
  fromDbCompanyRole,
  toDbCompanyRole,
} from "@/server/enum-map";
import type { Company, CompanyMembership, User } from "@prisma/client";

type CompanyWithMembers = Company & {
  memberships: (CompanyMembership & { user: User })[];
};

const COMPANY_TYPE_TO_DB: Record<CompanyTypeValue, Company["type"]> = {
  private_company: "PRIVATE_COMPANY",
  listed_company: "LISTED_COMPANY",
  bank: "BANK",
  brokerage: "BROKERAGE",
  issuer: "ISSUER",
  institution: "INSTITUTION",
};

const COMPANY_TYPE_FROM_DB: Record<Company["type"], CompanyTypeValue> = {
  PRIVATE_COMPANY: "private_company",
  LISTED_COMPANY: "listed_company",
  BANK: "bank",
  BROKERAGE: "brokerage",
  ISSUER: "issuer",
  INSTITUTION: "institution",
};

export function toDbCompanyType(type: CompanyTypeValue): Company["type"] {
  return COMPANY_TYPE_TO_DB[type];
}

export function fromDbCompanyTypeValue(type: Company["type"]): CompanyTypeValue {
  return COMPANY_TYPE_FROM_DB[type];
}

export function parseIntendedUses(values: string[]): IntendedUseValue[] {
  const allowed: IntendedUseValue[] = [
    "business_banking",
    "ipo_listing",
    "issuer_portal",
    "api_access",
    "other",
  ];
  return values.filter((v): v is IntendedUseValue => allowed.includes(v as IntendedUseValue));
}

export function mapMember(membership: CompanyMembership & { user: User }): CompanyMember {
  return {
    membershipId: membership.id,
    userId: membership.userId,
    discordUsername: membership.user.discordUsername,
    minecraftUsername: membership.user.minecraftUsername,
    role: fromDbCompanyRole(membership.role),
    joinedAt: membership.createdAt.toISOString(),
    accountStatus: formatDbAccountStatusLabel(fromDbAccountStatus(membership.user.accountStatus)),
  };
}

function formatDbAccountStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapCompanySummary(
  company: Company,
  role: AppCompanyRole,
): CompanySummary {
  return {
    id: company.id,
    name: company.name,
    type: formatDbCompanyType(company.type),
    sector: company.sector,
    ticker: company.ticker,
    desiredTicker: company.desiredTicker,
    status: formatDbCompanyStatus(company.status),
    verificationStatus: formatDbVerificationStatus(company.verificationStatus),
    role,
    createdAt: company.createdAt.toISOString(),
  };
}

export function mapCompanyDetail(
  company: CompanyWithMembers,
  currentUserId: string,
  currentUserRole: AppCompanyRole,
): CompanyDetail {
  const canManage = currentUserRole === "owner" || currentUserRole === "executive";
  const members = company.memberships
    .map(mapMember)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  return {
    id: company.id,
    name: company.name,
    type: formatDbCompanyType(company.type),
    typeValue: fromDbCompanyTypeValue(company.type),
    sector: company.sector,
    description: company.description,
    headquarters: company.headquarters,
    ticker: company.ticker,
    desiredTicker: company.desiredTicker,
    primaryContactDiscordUsername: company.primaryContactDiscordUsername,
    intendedUses: parseIntendedUses(company.intendedUses),
    status: formatDbCompanyStatus(company.status),
    verificationStatus: formatDbVerificationStatus(company.verificationStatus),
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    currentUserRole,
    canManage,
    canManageMembers: canManage,
    canEditSettings: currentUserRole === "owner",
    members,
    memberCount: members.length,
  };
}

export function mapInternalCompanyRow(
  company: Company & { _count: { memberships: number } },
): InternalCompanyRow {
  return {
    id: company.id,
    name: company.name,
    ticker: company.ticker,
    type: formatDbCompanyType(company.type),
    sector: company.sector,
    status: formatDbCompanyStatus(company.status),
    verificationStatus: formatDbVerificationStatus(company.verificationStatus),
    representativeCount: company._count.memberships,
    primaryContact: company.primaryContactDiscordUsername ?? "—",
    lastUpdated: company.updatedAt.toISOString().slice(0, 10),
  };
}

export function toDbMemberRole(role: AppCompanyRole): CompanyRole {
  return toDbCompanyRole(role);
}
