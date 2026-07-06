import { useMemo } from "react";
import type { SiteNavLink } from "@/config/sites";
import { buildBankPrimaryNavLinks } from "@/lib/bank/bank-primary-nav";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import { isPrivateClient } from "@/lib/auth/permissions";

export function useBankPrimaryNavLinks(): SiteNavLink[] {
  const user = useCurrentUser();
  const creditDesk = useCreditDeskCustomerNav();

  return useMemo(
    () =>
      buildBankPrimaryNavLinks({
        isPrivateMember: user !== null && isPrivateClient(user),
        creditDesk,
      }),
    [user, creditDesk],
  );
}
