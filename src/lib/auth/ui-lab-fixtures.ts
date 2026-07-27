/**
 * Deterministic UI Lab fixtures that mirror the mock user identity without
 * touching Prisma. Production paths must never call these.
 */
import type { UserBankSummary } from "@/lib/bank/backend-types";
import type { AltaUser } from "@/lib/auth/types";
import type { CompaniesDashboardData, CompanySummary } from "@/lib/company/types";
import { getUiLabUserIfEnabled, isUiLabMode } from "@/lib/auth/ui-lab";

export function getUiLabBankSummary(): UserBankSummary {
  return {
    totalBalance: 128_450.75,
    activeAccountCount: 2,
    pendingAccountCount: 0,
    pendingDepositCount: 0,
    pendingWithdrawalCount: 0,
  };
}

export function companiesFromUiLabUser(user: AltaUser): CompanySummary[] {
  return user.companyMemberships.map((m) => ({
    id: m.companyId,
    name: m.companyName,
    type: m.companyType,
    sector: null,
    ticker: m.companyTicker,
    desiredTicker: null,
    status: m.companyStatus,
    verificationStatus: m.companyVerificationStatus,
    role: m.role,
    createdAt: user.createdAt,
  }));
}

export function getUiLabCompaniesDashboard(): CompaniesDashboardData | null {
  if (!isUiLabMode()) return null;
  const user = getUiLabUserIfEnabled();
  if (!user) return null;
  return {
    companies: companiesFromUiLabUser(user),
    invitations: [],
  };
}

export { resolveUiLabCompanyName, resolveCompanyDisplayName } from "@/lib/bank/ui-lab-alta-card-state";

export {
  UI_LAB_CORE_ACCOUNT_ID,
  UI_LAB_CORE_COMPANY_ID,
  UI_LAB_PRO_ACCOUNT_ID,
  UI_LAB_PRO_COMPANY_ID,
  resetUiLabCommercialOverlays,
  setUiLabCommercialInsufficientFunds,
} from "@/lib/bank/ui-lab-commercial-fixtures";
