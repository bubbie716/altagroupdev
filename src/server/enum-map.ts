import type {
  AccountStatus,
  CompanyRole,
  UserTag,
} from "@/lib/auth/types";
import type {
  AccountStatus as DbAccountStatus,
  CompanyRole as DbCompanyRole,
  CompanyStatus as DbCompanyStatus,
  CompanyType as DbCompanyType,
  UserTag as DbUserTag,
  VerificationStatus as DbVerificationStatus,
} from "@prisma/client";

const USER_TAG_TO_DB: Record<UserTag, DbUserTag> = {
  corporate_admin: "CORPORATE_ADMIN",
  bank_admin: "BANK_ADMIN",
  terminal_admin: "TERMINAL_ADMIN",
};

/** PRIVATE_CLIENT is a retired DB-only value with no application meaning. */
const USER_TAG_FROM_DB: Record<DbUserTag, UserTag | null> = {
  CORPORATE_ADMIN: "corporate_admin",
  BANK_ADMIN: "bank_admin",
  TERMINAL_ADMIN: "terminal_admin",
  PRIVATE_CLIENT: null,
};

const ACCOUNT_STATUS_TO_DB: Record<AccountStatus, DbAccountStatus> = {
  active: "ACTIVE",
  restricted: "RESTRICTED",
  frozen: "FROZEN",
  pending_review: "PENDING_REVIEW",
};

const ACCOUNT_STATUS_FROM_DB: Record<DbAccountStatus, AccountStatus> = {
  ACTIVE: "active",
  RESTRICTED: "restricted",
  FROZEN: "frozen",
  PENDING_REVIEW: "pending_review",
};

const COMPANY_ROLE_TO_DB: Record<CompanyRole, DbCompanyRole> = {
  owner: "OWNER",
  executive: "EXECUTIVE",
  finance_manager: "FINANCE_MANAGER",
  compliance_contact: "COMPLIANCE_CONTACT",
  viewer: "VIEWER",
};

const COMPANY_ROLE_FROM_DB: Record<DbCompanyRole, CompanyRole> = {
  OWNER: "owner",
  EXECUTIVE: "executive",
  FINANCE_MANAGER: "finance_manager",
  COMPLIANCE_CONTACT: "compliance_contact",
  VIEWER: "viewer",
};

export function toDbUserTag(tag: UserTag): DbUserTag {
  return USER_TAG_TO_DB[tag];
}

export function fromDbUserTag(tag: DbUserTag): UserTag | null {
  return USER_TAG_FROM_DB[tag];
}

export function fromDbUserTags(tags: { tag: DbUserTag }[]): UserTag[] {
  return tags.flatMap((assignment) => {
    const mapped = fromDbUserTag(assignment.tag);
    return mapped ? [mapped] : [];
  });
}

export function toDbAccountStatus(status: AccountStatus): DbAccountStatus {
  return ACCOUNT_STATUS_TO_DB[status];
}

export function fromDbAccountStatus(status: DbAccountStatus): AccountStatus {
  return ACCOUNT_STATUS_FROM_DB[status];
}

export function toDbCompanyRole(role: CompanyRole): DbCompanyRole {
  return COMPANY_ROLE_TO_DB[role];
}

export function fromDbCompanyRole(role: DbCompanyRole): CompanyRole {
  return COMPANY_ROLE_FROM_DB[role];
}

export function formatDbCompanyType(type: DbCompanyType): string {
  if (type === "ISSUER") return "Private Company";
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatDbCompanyStatus(status: DbCompanyStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatDbVerificationStatus(status: DbVerificationStatus): string {
  if (status === "UNVERIFIED") return "Unverified";
  if (status === "PENDING") return "Pending Review";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
