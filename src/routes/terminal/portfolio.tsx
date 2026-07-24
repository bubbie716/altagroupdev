import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchTerminalPortfolio } from "@/lib/terminal/terminal.functions";

/** Redirect `/terminal/portfolio` to the resolved default / recent portfolio. */
export const Route = createFileRoute("/terminal/portfolio")({
  loader: async () => {
    const data = await fetchTerminalPortfolio({ data: {} });
    if (data.selectedPortfolio?.id) {
      throw redirect({
        to: "/terminal/portfolio/$portfolioId",
        params: { portfolioId: data.selectedPortfolio.id },
      });
    }
    throw redirect({
      to: "/terminal/portfolio/$portfolioId",
      params: { portfolioId: "new" },
    });
  },
  component: () => null,
});
