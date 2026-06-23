import type { CompanyRole } from "@/lib/auth/types";

export type CompanyTypeValue =
  | "private_company"
  | "listed_company"
  | "bank"
  | "brokerage"
  | "issuer"
  | "institution";

export type IntendedUseValue =
  | "business_banking"
  | "ipo_listing"
  | "issuer_portal"
  | "api_access"
  | "other";

export interface CompanySummary {
  id: string;
  name: string;
  type: string;
  sector: string | null;
  ticker: string | null;
  desiredTicker: string | null;
  status: string;
  verificationStatus: string;
  role: CompanyRole;
  createdAt: string;
}

export interface CompanyMember {
  membershipId: string;
  userId: string;
  discordUsername: string;
  minecraftUsername: string | null;
  role: CompanyRole;
  joinedAt: string;
  accountStatus: string;
}

export interface CompanyDetail {
  id: string;
  name: string;
  type: string;
  typeValue: CompanyTypeValue;
  sector: string | null;
  description: string | null;
  headquarters: string | null;
  ticker: string | null;
  desiredTicker: string | null;
  primaryContactDiscordUsername: string | null;
  intendedUses: IntendedUseValue[];
  status: string;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
  currentUserRole: CompanyRole;
  canManage: boolean;
  canManageMembers: boolean;
  canEditSettings: boolean;
  members: CompanyMember[];
  memberCount: number;
}

export interface CreateCompanyInput {
  name: string;
  type: CompanyTypeValue;
  sector: string;
  desiredTicker?: string;
  description: string;
  headquarters?: string;
  primaryContactDiscordUsername?: string;
  intendedUses: IntendedUseValue[];
}

export interface UpdateCompanySettingsInput {
  companyId: string;
  name: string;
  sector: string;
  description: string;
  headquarters?: string;
  desiredTicker?: string;
}

export interface UpdateMemberRoleInput {
  companyId: string;
  membershipId: string;
  role: CompanyRole;
}

export interface RemoveMemberInput {
  companyId: string;
  membershipId: string;
}

export interface SendInvitationInput {
  companyId: string;
  discordIdentifier: string;
  role: CompanyRole;
}

export interface CompanyInvitationSummary {
  id: string;
  companyId: string;
  companyName: string;
  companyType: string;
  role: CompanyRole;
  invitedByUsername: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CompaniesDashboardData {
  companies: CompanySummary[];
  invitations: CompanyInvitationSummary[];
}

export interface InternalCompanyRow {
  id: string;
  name: string;
  ticker: string | null;
  type: string;
  sector: string | null;
  status: string;
  verificationStatus: string;
  representativeCount: number;
  primaryContact: string;
  lastUpdated: string;
}

export const COMPANY_TYPE_OPTIONS: { value: CompanyTypeValue; label: string }[] = [
  { value: "private_company", label: "Private Company" },
  { value: "listed_company", label: "Listed Company" },
  { value: "issuer", label: "Issuer" },
  { value: "institution", label: "Institution" },
  { value: "bank", label: "Bank" },
  { value: "brokerage", label: "Brokerage" },
];

export const INTENDED_USE_OPTIONS: { value: IntendedUseValue; label: string }[] = [
  { value: "business_banking", label: "Business banking" },
  { value: "ipo_listing", label: "IPO / listing" },
  { value: "issuer_portal", label: "Exchange issuer portal" },
  { value: "api_access", label: "API / developer access" },
  { value: "other", label: "Other" },
];

export const MEMBER_ROLE_OPTIONS: { value: CompanyRole; label: string }[] = [
  { value: "executive", label: "Executive" },
  { value: "finance_manager", label: "Finance Manager" },
  { value: "compliance_contact", label: "Compliance Contact" },
  { value: "viewer", label: "Viewer" },
];

export const OWNER_ROLE_OPTION: { value: CompanyRole; label: string } = {
  value: "owner",
  label: "Owner",
};

export function formatIntendedUse(use: IntendedUseValue): string {
  return INTENDED_USE_OPTIONS.find((o) => o.value === use)?.label ?? use;
}
