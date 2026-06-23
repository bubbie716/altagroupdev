/**
 * Alta platform auth & account types.
 *
 * Future model: Individual Discord User → Memberships[] → Company → Permissions
 * Companies do not authenticate directly; representatives act on their behalf.
 */

/** Backend permission tags — a user may have multiple. */
export type UserTag = "admin" | "operator" | "private_client" | "developer" | "issuer";

export type AccountStatus = "active" | "restricted" | "frozen" | "pending_review";

export type DeveloperAccessStatus = "none" | "pending" | "approved" | "suspended";

export type CompanyRole =
  | "owner"
  | "executive"
  | "finance_manager"
  | "compliance_contact"
  | "viewer";

/** Registered entity — not a login principal. */
export interface Company {
  id: string;
  name: string;
  type: string;
  ticker: string | null;
  sector: string;
  status: string;
  verificationStatus: string;
}

/** Links a user to a company with a scoped role (future permission enforcement). */
export interface CompanyMembership {
  userId: string;
  companyId: string;
  role: CompanyRole;
}

export interface EnrichedCompanyMembership extends CompanyMembership {
  companyName: string;
  companyType: string;
  companyTicker: string | null;
  companyStatus: string;
  companyVerificationStatus: string;
}

export interface AltaUser {
  id: string;
  discordId: string;
  discordUsername: string;
  avatarUrl: string | null;
  email: string | null;
  minecraftUsername: string | null;
  /** Backend tags (admin, private_client, …). Not shown as “roles” in the UI. */
  tags: UserTag[];
  accountStatus: AccountStatus;
  developerAccessStatus: DeveloperAccessStatus;
  developerAccess: boolean;
  internalAccess: boolean;
  companyMemberships: EnrichedCompanyMembership[];
  createdAt: string;
  lastLoginAt: string;
}

export interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  email?: string | null;
}
