import { createFileRoute, redirect } from "@tanstack/react-router";

type BankWithdrawSearch = {
  accountId?: string;
};

/** Compatibility redirect — withdrawal history lives in Activity → Requests. */
export const Route = createFileRoute("/bank/withdraw")({
  validateSearch: (search: Record<string, unknown>): BankWithdrawSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank",
      search: {
        action: "withdraw",
        ...(search.accountId ? { accountId: search.accountId } : {}),
      },
      replace: true,
    });
  },
});
