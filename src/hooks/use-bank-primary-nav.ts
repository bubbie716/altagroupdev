import { useMemo } from "react";
import type { SiteNavLink } from "@/config/sites";
import { buildBankDesktopPrimaryLinks } from "@/lib/bank/bank-primary-nav";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

export function useBankPrimaryNavLinks(): SiteNavLink[] {
  const creditDesk = useCreditDeskCustomerNav();

  return useMemo(() => buildBankDesktopPrimaryLinks(creditDesk), [creditDesk]);
}
