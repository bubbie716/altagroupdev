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

const creditDeskNavCache = new Map<string, CreditDeskCustomerNav>();

function getCachedCreditDeskNav(userId: string | undefined): CreditDeskCustomerNav {
  if (!userId) return CREDIT_DESK_NAV_LOADING;
  return creditDeskNavCache.get(userId) ?? CREDIT_DESK_NAV_LOADING;
}

export function useCreditDeskCustomerNav(): CreditDeskCustomerNav {
  const user = useCurrentUser();
  const userId = user?.id;
  const fetchNav = useServerFn(fetchCreditDeskCustomerNav);
  const [nav, setNav] = useState<CreditDeskCustomerNav>(() => getCachedCreditDeskNav(userId));

  useEffect(() => {
    if (!userId) {
      setNav(CREDIT_DESK_NAV_LOADING);
      return;
    }

    if (creditDeskNavCache.has(userId)) {
      return;
    }

    let cancelled = false;
    void fetchNav()
      .then((data) => {
        if (cancelled) return;
        creditDeskNavCache.set(userId, data);
        setNav(data);
      })
      .catch(() => {
        if (cancelled || creditDeskNavCache.has(userId)) return;
        setNav(CREDIT_DESK_NAV_LOADING);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, fetchNav]);

  return nav;
}

/** Clears cached nav after Credit Desk status changes (internal settings). */
export function invalidateCreditDeskNavCache(): void {
  creditDeskNavCache.clear();
}
