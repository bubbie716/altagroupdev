import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { fetchTerminalSystemStatus } from "@/lib/terminal/terminal-ops.functions";
import type { TerminalOpsSystemStatus } from "@/lib/terminal/terminal-ops-admin.service";
import type { TerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  terminalReadinessCategory,
  terminalReadinessLabel,
  type TerminalReadinessItem,
  type TerminalReadinessStatus,
} from "@/lib/terminal/terminal-desk";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import { formatActivityDateTime } from "@/lib/format-datetime";

export type TerminalSystemSearch = { site?: string };

export const Route = createFileRoute("/internal/terminal/system")({
  validateSearch: (s: Record<string, unknown>): TerminalSystemSearch => ({
    site: validateDevSiteSearch(s).site,
  }),
  loader: () => fetchTerminalSystemStatus(),
  head: ({ match }) => ({
    meta: [
      {
        title: internalDocumentTitle(
          "Terminal System",
          (match.search as { site?: string }).site ?? "terminal",
        ),
      },
    ],
  }),
  component: TerminalSystemPage,
});

type ConnectionOperatorState = "Connected" | "Demonstration" | "Unavailable";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border/70 bg-surface-1/30 px-4 py-3">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-2 text-[13px]">{children}</div>
    </section>
  );
}

function connectionOperatorState(env: TerminalOpsEnvironmentStatus): ConnectionOperatorState {
  if (env.connectionState === "live" && env.marketDataTrustworthy) {
    return "Connected";
  }
  if (env.connectionState === "mock" || env.isDemonstration) {
    return "Demonstration";
  }
  return "Unavailable";
}

function connectionStateTone(state: ConnectionOperatorState): string {
  if (state === "Connected") {
    return "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100";
  }
  if (state === "Demonstration") {
    return "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100";
  }
  return "border-rose-500/40 bg-rose-500/5 text-rose-900 dark:text-rose-100";
}

function readinessFromStatus(status: TerminalOpsSystemStatus): TerminalReadinessItem[] {
  const env = status.environment;
  const demo = env.isDemonstration || env.connectionState === "mock";

  const tseStatus: TerminalReadinessStatus = demo
    ? "demonstration_only"
    : "blocked_by_newport";

  const cryptoReconStatus: TerminalReadinessStatus = demo
    ? "demonstration_only"
    : !status.cryptoReconciliation.available
      ? "not_configured"
      : status.cryptoReconciliation.openCritical > 0
        ? "failed"
        : status.cryptoReconciliation.lastSuccessfulAt
          ? "ready"
          : "not_configured";

  const cryptoMarketsStatus: TerminalReadinessStatus =
    status.cryptoMarkets.statusLabel === "Critical issue"
      ? "failed"
      : status.cryptoMarkets.statusLabel === "Active"
        ? "ready"
        : status.cryptoMarkets.statusLabel === "Ready to activate" ||
            status.cryptoMarkets.statusLabel === "Draft" ||
            status.cryptoMarkets.statusLabel === "Halted" ||
            status.cryptoMarkets.statusLabel === "Redemption only" ||
            status.cryptoMarkets.statusLabel === "Degraded"
          ? "not_configured"
          : demo
            ? "demonstration_only"
            : "not_configured";

  const items: TerminalReadinessItem[] = [
    {
      id: "local-db",
      label: "Database",
      status: demo
        ? "demonstration_only"
        : status.localDatabase.available
          ? "ready"
          : "failed",
      detail: status.localDatabase.detail,
    },
    {
      id: "crypto-markets",
      label: "Crypto markets",
      status: cryptoMarketsStatus,
      detail: `${status.cryptoMarkets.statusLabel} — ${status.cryptoMarkets.detail}`,
    },
    {
      id: "crypto-recon",
      label: "Crypto reconciliation",
      status: cryptoReconStatus,
      detail: status.cryptoReconciliation.detail,
    },
    {
      id: "candle-rollup",
      label: "Candle rollup",
      status: demo
        ? "demonstration_only"
        : status.candleRollup.available
          ? "ready"
          : "not_configured",
      detail: status.candleRollup.detail,
    },
    {
      id: "revenue-sweep",
      label: "Revenue sweep readiness",
      status: demo
        ? "demonstration_only"
        : status.revenueSweep.available
          ? "ready"
          : "not_configured",
      detail: status.revenueSweep.detail,
    },
    {
      id: "audit",
      label: "Audit readiness",
      status: demo
        ? "demonstration_only"
        : status.audit.available
          ? "ready"
          : "not_implemented",
      detail: status.audit.detail,
    },
    {
      id: "secrets",
      label: "Configuration / secrets",
      status: demo
        ? "demonstration_only"
        : status.configurationSecrets.quoteSecretConfigured
          ? status.configurationSecrets.revenuePortfolioConfigured
            ? "ready"
            : "not_configured"
          : "not_configured",
      detail: status.configurationSecrets.detail,
    },
    {
      id: "backup",
      label: "Backup freshness",
      status: "not_configured",
      detail: status.backupReadiness.detail,
    },
    {
      id: "jobs",
      label: "Jobs catalog",
      status: demo
        ? "demonstration_only"
        : status.jobs.available
          ? "ready"
          : "not_implemented",
      detail: status.jobs.detail,
    },
    {
      id: "tse",
      label: "TSE adapter",
      status: tseStatus,
      detail: "Stock TSE adapter is not wired. Do not treat as healthy.",
    },
    {
      id: "market-data",
      label: "Newport / live market data",
      status: "blocked_by_newport",
      detail: status.newportLiveMarket.detail,
    },
    {
      id: "order-execution",
      label: "TSE order execution",
      status: "blocked_by_newport",
      detail: status.orderExecution.detail,
    },
    {
      id: "portfolio-sync",
      label: "TSE portfolio sync",
      status: "blocked_by_newport",
      detail: status.synchronization.detail,
    },
    {
      id: "tse-custody",
      label: "TSE pooled-custody reconciliation",
      status: "blocked_by_newport",
      detail: status.reconciliation.detail,
    },
  ];

  return items.map((item) => ({
    ...item,
    category: terminalReadinessCategory(item.status),
  }));
}

const CATEGORY_ORDER = [
  "available_now",
  "demonstration_only",
  "not_configured",
  "failed",
  "not_implemented",
  "blocked_by_newport",
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  available_now: "Available now",
  demonstration_only: "Demonstration only",
  not_configured: "Not configured",
  failed: "Failed / attention",
  not_implemented: "Not implemented",
  blocked_by_newport: "Blocked by Newport/TSE",
};

function TerminalSystemPage() {
  const status = Route.useLoaderData() as TerminalOpsSystemStatus;
  const env = status.environment;
  const readiness = readinessFromStatus(status);
  const search = Route.useSearch();
  const connectionState = connectionOperatorState(env);

  return (
    <InternalPageShell title="System">
      <div className="space-y-4">
        <Section title="Connection">
          <div
            className={`rounded-md border px-4 py-3 ${connectionStateTone(connectionState)}`}
            role="status"
          >
            <p className="text-[13px] font-medium text-foreground/90">{connectionState}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{env.detail}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Last checked · {env.lastCheckedAt.slice(0, 19).replace("T", " ")}
            </p>
          </div>
          <div className="mt-3 rounded-md border border-border/50 px-4 py-3" role="status">
            <p className="text-[13px] font-medium text-foreground/90">
              <Link
                to="/internal/terminal/crypto"
                search={withInternalSiteSearch({}, search.site)}
                className="text-gold hover:underline"
              >
                {env.cryptoMarketsLabel}
              </Link>
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{env.cryptoMarketsDetail}</p>
            {status.cryptoMarkets.assetStatuses.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
                {status.cryptoMarkets.assetStatuses.map((a) => (
                  <li
                    key={a.symbol}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <Link
                      to="/internal/terminal/crypto/$symbol"
                      params={{ symbol: a.symbol }}
                      search={withInternalSiteSearch({ tab: "overview" }, search.site)}
                      className="font-mono text-gold hover:underline"
                    >
                      {a.symbol}
                    </Link>
                    <span>
                      {a.status === "DRAFT"
                        ? "Draft"
                        : a.status === "ACTIVE"
                          ? "Active"
                          : a.status === "HALTED"
                            ? "Trading halted"
                            : a.status === "REDEMPTION_ONLY"
                              ? "Redemption only"
                              : a.status === "CLOSED"
                                ? "Closed"
                                : a.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Section>

        <Section title="Crypto integrity">
          <WorkspaceLikeGrid>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </p>
              <p className="mt-0.5">{status.cryptoReconciliation.statusLabel}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Open critical
              </p>
              <p className="mt-0.5 tabular-nums">{status.cryptoReconciliation.openCritical}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Open warnings
              </p>
              <p className="mt-0.5 tabular-nums">{status.cryptoReconciliation.openWarning}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Last successful recon
              </p>
              <p className="mt-0.5 text-[12px]">
                {status.cryptoReconciliation.lastSuccessfulAt
                  ? formatActivityDateTime(status.cryptoReconciliation.lastSuccessfulAt)
                  : "Never"}
              </p>
            </div>
          </WorkspaceLikeGrid>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {status.cryptoReconciliation.detail}{" "}
            <Link
              to="/internal/terminal/crypto"
              search={withInternalSiteSearch({}, search.site)}
              className="text-gold hover:underline"
            >
              Open crypto markets
            </Link>
          </p>
        </Section>

        <Section title="Readiness">
          {CATEGORY_ORDER.map((category) => {
            const rows = readiness.filter((item) => item.category === category);
            if (rows.length === 0) return null;
            return (
              <div key={category} className="mb-4 last:mb-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </p>
                <ul className="mt-1.5 space-y-2">
                  {rows.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
                    >
                      {item.id === "crypto-markets" || item.id === "crypto-recon" ? (
                        <Link
                          to="/internal/terminal/crypto"
                          search={withInternalSiteSearch({}, search.site)}
                          className="text-gold hover:underline"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {terminalReadinessLabel(item.status)}
                      </span>
                      {item.detail ? (
                        <p className="w-full text-[11px] text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Section>

        <details className="rounded-md border border-border/50 px-4 py-3 text-[12px] text-muted-foreground">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em]">
            Technical details
          </summary>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Adapter type
              </dt>
              <dd className="mt-0.5 font-mono text-[12px] text-foreground">{env.adapterName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Endpoint
              </dt>
              <dd className="mt-0.5 font-mono text-[12px] text-foreground">
                {env.endpointHost ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Raw mode
              </dt>
              <dd className="mt-0.5 font-mono text-[12px] text-foreground">{env.mode}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Newport / TSE backlog
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {status.reconciliation.readiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
              <li>{status.newportLiveMarket.detail}</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Implementation notes
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>{status.localDatabase.detail}</li>
              <li>{status.cryptoReconciliation.detail}</li>
              <li>{status.candleRollup.detail}</li>
              <li>{status.revenueSweep.detail}</li>
              <li>{status.configurationSecrets.detail}</li>
              <li>{status.backupReadiness.detail}</li>
              <li>{status.jobs.detail}</li>
              <li>{status.audit.detail}</li>
              <li>
                Crypto markets: {status.cryptoMarkets.statusLabel}. {status.cryptoMarkets.detail}{" "}
                <Link
                  to="/internal/terminal/crypto"
                  search={withInternalSiteSearch({}, search.site)}
                  className="text-gold hover:underline"
                >
                  Open crypto markets
                </Link>
                .
              </li>
              <li>{status.recurringTrades.detail}</li>
              <li>
                No fake healthy values for unavailable TSE systems. Alta Crypto ops remain on Crypto
                markets.
              </li>
            </ul>
          </div>
          <p className="mt-4 text-[12px]">
            Terminal maintenance:{" "}
            <Link
              to="/internal/terminal/settings"
              search={withInternalSiteSearch({}, search.site)}
              className="text-gold hover:underline"
            >
              Terminal Settings
            </Link>
            .
          </p>
        </details>
      </div>
    </InternalPageShell>
  );
}

function WorkspaceLikeGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
