import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseBankAccountTypeCode } from "@/lib/bank/bank-product-account-type";

type BankOpenSearch = {
  accountType?: string;
  companyId?: string;
};

/** Compatibility redirect — open-account is a modal on Accounts. */
export const Route = createFileRoute("/bank/open")({
  validateSearch: (search: Record<string, unknown>): BankOpenSearch => {
    const result: BankOpenSearch = {};
    const accountType = parseBankAccountTypeCode(search.accountType);
    if (accountType) result.accountType = accountType;
    if (typeof search.companyId === "string" && search.companyId.trim()) {
      result.companyId = search.companyId.trim();
    }
    return result;
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank/accounts",
      search: {
        action: "open-account",
        ...(search.accountType ? { accountType: search.accountType } : {}),
        ...(search.companyId ? { companyId: search.companyId } : {}),
      },
      replace: true,
    });
  },
});
