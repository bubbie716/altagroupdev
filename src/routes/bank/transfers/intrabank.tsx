import { createFileRoute, redirect } from "@tanstack/react-router";

type BankIntrabankSearch = {
  accountId?: string;
};

/** Compatibility redirect — transfer form is a modal; history/schedules live in Activity. */
export const Route = createFileRoute("/bank/transfers/intrabank")({
  validateSearch: (search: Record<string, unknown>): BankIntrabankSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/bank",
      search: {
        action: "transfer",
        ...(search.accountId ? { accountId: search.accountId } : {}),
      },
      replace: true,
    });
  },
});
