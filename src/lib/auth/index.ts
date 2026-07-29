export type { AltaUser, UserTag, CompanyRole, AccountStatus } from "./types";
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
  COMPANY_MANAGEMENT_ROLES,
  findCompanyMembership,
  isAdmin,
  isCorporateAdmin,
  isBankAdmin,
  isTerminalAdmin,
  canAccessAnyInternal,
  canAccessBankInternal,
  canAccessTerminalInternal,
  canAccessInternalForSite,
  canBypassMaintenanceMode,
  isCompanyOwner,
  isCompanyExecutive,
  isCompanyFinanceManager,
  isCompanyComplianceContact,
  canManageCompany,
} from "./permissions";
export type { CompanyScope } from "./permissions";
export { authBeforeLoad, internalBeforeLoad } from "./guards";
