import { createFileRoute, Outlet } from "@tanstack/react-router";

export type BusinessBankingSearch = {
  companyId?: string;
};

/** Layout for /bank/business — marketing index + legacy redirect child routes. */
export const Route = createFileRoute("/bank/business")({
  validateSearch: (search: Record<string, unknown>): BusinessBankingSearch => ({
    companyId: typeof search.companyId === "string" ? search.companyId : undefined,
  }),
  component: () => <Outlet />,
});
