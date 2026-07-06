import type { SiteNavLink } from "@/config/sites";
import type { CreditDeskCustomerNav } from "@/lib/platform/credit-desk-types";

export type BankPrimaryNavOptions = {
  isPrivateMember: boolean;
  creditDesk: CreditDeskCustomerNav;
};

const STATIC_BANK_PRIMARY_LINKS: SiteNavLink[] = [
  {
    label: "Dashboard",
    to: "/bank",
    exact: true,
    match: "/bank",
    activePaths: ["/bank/account"],
  },
  { label: "Deposit", to: "/bank/deposit", match: "/bank/deposit" },
  { label: "Withdraw", to: "/bank/withdraw", match: "/bank/withdraw" },
  { label: "Transfers", to: "/bank/transfers", match: "/bank/transfers" },
  { label: "Alta Pay", to: "/bank/pay", match: "/bank/pay" },
  { label: "Alta Card", to: "/bank/alta-card", match: "/bank/alta-card" },
  {
    label: "Products",
    to: "/bank/products",
    match: "/bank/products",
    activePaths: ["/bank/deposits"],
  },
  { label: "Statements", to: "/bank/statements", match: "/bank/statements" },
  { label: "Settings", to: "/bank/settings", match: "/bank/settings" },
  { label: "Lending", to: "/bank/lending", match: "/bank/lending" },
  { label: "Alta Private", to: "/bank/private", match: "/bank/private" },
];

export function buildBankPrimaryNavLinks({
  isPrivateMember,
  creditDesk,
}: BankPrimaryNavOptions): SiteNavLink[] {
  return STATIC_BANK_PRIMARY_LINKS.flatMap((link) => {
    if (link.label === "Alta Private" && !isPrivateMember) return [];

    if (link.label === "Lending") {
      if (!creditDesk.showLendingNav) return [];
      if (creditDesk.creditDeskClosed) {
        return [{ label: "Loans", to: "/bank/lending/loans", match: "/bank/lending" }];
      }
      return [link];
    }

    if (link.label === "Alta Card" && !creditDesk.showAltaCardNav) return [];

    return [link];
  });
}
