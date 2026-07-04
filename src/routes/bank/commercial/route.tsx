import { createFileRoute, Outlet } from "@tanstack/react-router";

export type CommercialBankingSearch = {
  companyId?: string;
};

export const Route = createFileRoute("/bank/commercial")({
  validateSearch: (search: Record<string, unknown>): CommercialBankingSearch => ({
    companyId: typeof search.companyId === "string" ? search.companyId : undefined,
  }),
  component: () => <Outlet />,
});
