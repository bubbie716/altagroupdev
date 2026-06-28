import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchCreditDeskCustomerNav } from "@/lib/platform/platform-settings.functions";
import type { CreditDeskCustomerNav } from "@/lib/platform/credit-desk-types";
import { useCurrentUser } from "@/hooks/use-current-user";

const CREDIT_DESK_NAV_LOADING: CreditDeskCustomerNav = {
  creditDeskClosed: false,
  showLendingNav: false,
  showAltaCardNav: false,
  showApplyEntryPoints: false,
};

export function useCreditDeskCustomerNav(): CreditDeskCustomerNav {
  const user = useCurrentUser();
  const fetchNav = useServerFn(fetchCreditDeskCustomerNav);
  const [nav, setNav] = useState<CreditDeskCustomerNav>(CREDIT_DESK_NAV_LOADING);

  useEffect(() => {
    if (!user) {
      setNav(CREDIT_DESK_NAV_LOADING);
      return;
    }
    void fetchNav()
      .then(setNav)
      .catch(() => setNav(CREDIT_DESK_NAV_LOADING));
  }, [user, fetchNav]);

  return nav;
}
