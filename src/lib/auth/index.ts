export type { AltaUser, UserTag, CompanyRole, AccountStatus, DeveloperAccessStatus } from "./types";
export {
  hasTag,
  hasAnyTag,
  hasAllTags,
  canAccessInternal,
  formatCompanyRole,
  formatAccountStatus,
  formatUserTag,
} from "./tags";
export {
  ISSUER_PORTAL_ROLES,
  COMPANY_MANAGEMENT_ROLES,
  findCompanyMembership,
  isAdmin,
  isCorporateAdmin,
  isBankAdmin,
  isTerminalAdmin,
  isPrivateClient,
  isDeveloper,
  canAccessAnyInternal,
  canAccessBankInternal,
  canAccessInternalForSite,
  canBypassMaintenanceMode,
  isCompanyOwner,
  isCompanyExecutive,
  isCompanyFinanceManager,
  isCompanyComplianceContact,
  canManageCompany,
  canSubmitFilings,
  canAccessIssuerPortal,
} from "./permissions";
export type { CompanyScope } from "./permissions";
export {
  authBeforeLoad,
  internalBeforeLoad,
  privateClientBeforeLoad,
  developerBeforeLoad,
  issuerPortalBeforeLoad,
} from "./guards";
