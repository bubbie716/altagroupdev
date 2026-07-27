import { createFileRoute, redirect } from "@tanstack/react-router";

type BankDepositSearch = {
  accountId?: string;
};

/** Compatibility redirect — deposit history lives in Activity → Requests. */
export const Route = createFileRoute("/bank/deposit")({
  validateSearch: (search: Record<string, unknown>): BankDepositSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank",
      search: {
        action: "deposit",
        ...(search.accountId ? { accountId: search.accountId } : {}),
      },
      replace: true,
    });
  },
});
