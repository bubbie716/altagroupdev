import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchTerminalPortfolio } from "@/lib/terminal/terminal.functions";

/** Exact `/terminal/portfolio` → default / recent / onboarding portfolio. */
export const Route = createFileRoute("/terminal/portfolio/")({
  loader: async () => {
    const data = await fetchTerminalPortfolio({ data: {} });
    throw redirect({
      to: "/terminal/portfolio/$portfolioId",
      params: { portfolioId: data.selectedPortfolio?.id ?? "new" },
      search: { range: "1D" },
    });
  },
});
