import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { buildListReturnPath, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { fetchTerminalInboxCases } from "@/lib/terminal/terminal-ops.functions";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TerminalInboxSearch = { site?: string };

export const Route = createFileRoute("/internal/terminal/inbox")({
  validateSearch: (s: Record<string, unknown>): TerminalInboxSearch => ({
    site: validateDevSiteSearch(s).site,
  }),
  loader: () => fetchTerminalInboxCases(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Terminal Inbox", (match.search as { site?: string }).site ?? "terminal") }] }),
  component: TerminalInboxPage,
});

function caseCategoryLabel(caseType: string): string {
  if (caseType === "maintenance" || caseType === "investor_restriction") return "Investor access";
  if (caseType === "portfolio_access") return "Access review";
  if (caseType === "rejected_order" || caseType === "failed_order") return "Rejected order";
  if (caseType === "stale_open_order") return "Stuck order";
  if (caseType === "connection_unavailable") return "Connection";
  return caseType.replace(/_/g, " ");
}

function casePrimaryAction(caseType: string, fallback: string): string {
  if (caseType === "rejected_order" || caseType === "failed_order") return "Review rejected order";
  if (caseType === "stale_open_order") return "Review stuck order";
  if (caseType === "portfolio_access") return "Review portfolio access";
  if (caseType === "connection_unavailable") return "Review connection issue";
  if (caseType === "maintenance") return "Review investor";
  if (caseType === "investor_restriction") return "Review investor";
  return fallback || "Review case";
}

function caseLink(
  href: string,
  site: string | undefined,
  from: string,
  children: ReactNode,
) {
  const withFrom = (base: Record<string, unknown>) =>
    withInternalSiteSearch({ ...base, from }, site);

  const orderMatch = href.match(/^\/internal\/terminal\/orders\/([^/?#]+)/);
  if (orderMatch) {
    return (
      <Link
        to="/internal/terminal/orders/$orderId"
        params={{ orderId: orderMatch[1]! }}
        search={withFrom({})}
        className="block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-border-strong"
      >
        {children}
      </Link>
    );
  }
  const portfolioMatch = href.match(/^\/internal\/terminal\/portfolios\/([^/?#]+)/);
  if (portfolioMatch) {
    return (
      <Link
        to="/internal/terminal/portfolios/$portfolioId"
        params={{ portfolioId: portfolioMatch[1]! }}
        search={withFrom({ tab: "overview" as const })}
        className="block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-border-strong"
      >
        {children}
      </Link>
    );
  }
  const userMatch = href.match(/^\/internal\/users\/([^/?#]+)/);
  if (userMatch) {
    return (
      <Link
        to="/internal/users/$userId"
        params={{ userId: userMatch[1]! }}
        search={withFrom({ tab: "overview" as const, section: "terminal" })}
        className="block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-border-strong"
      >
        {children}
      </Link>
    );
  }
  if (href.startsWith("/internal/terminal/system")) {
    return (
      <Link
        to="/internal/terminal/system"
        search={withFrom({})}
        className="block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-border-strong"
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to={href as "/"}
      search={withFrom({})}
      className="block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-border-strong"
    >
      {children}
    </Link>
  );
}

function TerminalInboxPage() {
  const cases = Route.useLoaderData() as Awaited<ReturnType<typeof fetchTerminalInboxCases>>;
  const search = Route.useSearch();
  const returnFrom = buildListReturnPath("/internal/terminal/inbox", { site: search.site });

  return (
    <InternalPageShell title="Terminal Inbox">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Cases that need operator attention — rejected orders, connection failures, and access
        issues.
      </p>

      {cases.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No Terminal cases need attention.</p>
      ) : (
        <ul className="space-y-3">
          {cases.map((item) => (
            <li key={item.id}>
              {caseLink(
                item.href,
                search.site,
                returnFrom,
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {caseCategoryLabel(item.caseType)}
                      </div>
                      <div className="mt-0.5 truncate font-medium">{item.title}</div>
                      <p className="mt-1 text-[12px] text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {item.ageLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                    {item.investorLabel ? <span>{item.investorLabel}</span> : null}
                    {item.portfolioLabel ? <span>{item.portfolioLabel}</span> : null}
                    {item.symbol ? <span className="font-mono">{item.symbol}</span> : null}
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                    {casePrimaryAction(item.caseType, item.primaryAction)}
                  </div>
                </>,
              )}
            </li>
          ))}
        </ul>
      )}
    </InternalPageShell>
  );
}
