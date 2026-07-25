import { useMemo } from "react";
import type { SiteNavLink } from "@/config/sites";
import { buildBankPrimaryNavLinks } from "@/lib/bank/bank-primary-nav";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";

export function useBankPrimaryNavLinks(): SiteNavLink[] {
  const creditDesk = useCreditDeskCustomerNav();

  return useMemo(() => buildBankPrimaryNavLinks({ creditDesk }), [creditDesk]);
}
