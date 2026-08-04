import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/internal/bank")({
  validateSearch: (search: Record<string, unknown>): { site?: string } => ({
    site: typeof search.site === "string" ? search.site : undefined,
  }),
  component: InternalBankLayout,
});

function InternalBankLayout() {
  return <Outlet />;
}
