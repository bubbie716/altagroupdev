import { createFileRoute } from "@tanstack/react-router";
import { TerminalPortfolioWorkspaceView } from "@/components/internal/workspace/terminal-portfolio-workspace-view";
import { parseTerminalPortfolioWorkspaceSearch } from "@/lib/internal/record-workspace-search";
import { fetchTerminalPortfolioDetail } from "@/lib/terminal/terminal-ops.functions";
import type { TerminalOpsPortfolioDetail } from "@/lib/terminal/terminal-ops-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/terminal/portfolios/$portfolioId")({
  validateSearch: (search: Record<string, unknown>) => parseTerminalPortfolioWorkspaceSearch(search),
  loader: async ({ params }): Promise<{ portfolio: TerminalOpsPortfolioDetail }> => {
    const portfolio = await fetchTerminalPortfolioDetail({ data: params.portfolioId });
    return { portfolio };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.portfolio.name ?? "Portfolio"}`, (match.search as { site?: string }).site ?? "terminal") }],
  }),
  component: TerminalPortfolioWorkspaceRoute,
});

function TerminalPortfolioWorkspaceRoute() {
  const { portfolio } = Route.useLoaderData();
  const search = Route.useSearch();
  return <TerminalPortfolioWorkspaceView portfolio={portfolio} search={search} />;
}
