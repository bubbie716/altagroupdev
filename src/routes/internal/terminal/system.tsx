import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { fetchTerminalSystemStatus } from "@/lib/terminal/terminal-ops.functions";
import type { TerminalOpsSystemStatus } from "@/lib/terminal/terminal-ops-admin.service";
import type { TerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";
import {
  terminalReadinessLabel,
  type TerminalReadinessItem,
  type TerminalReadinessStatus,
} from "@/lib/terminal/terminal-desk";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type TerminalSystemSearch = { site?: string };

export const Route = createFileRoute("/internal/terminal/system")({
  validateSearch: (s: Record<string, unknown>): TerminalSystemSearch => ({
    site: validateDevSiteSearch(s).site,
  }),
  loader: () => fetchTerminalSystemStatus(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Terminal System", (match.search as { site?: string }).site ?? "terminal") }] }),
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
  const tseStatus: TerminalReadinessStatus =
    env.connectionState === "live" && env.marketDataTrustworthy
      ? "ready"
      : env.connectionState === "unavailable" || env.connectionState === "degraded"
        ? "failed"
        : env.isDemonstration
          ? "not_configured"
          : "not_implemented";

  return [
    {
      id: "local-db",
      label: "Local Terminal database",
      status: status.localDatabase.available ? "ready" : "failed",
    },
    { id: "tse", label: "TSE adapter", status: tseStatus },
    {
      id: "market-data",
      label: "Market data",
      status: status.marketData.available ? "ready" : "not_implemented",
    },
    {
      id: "order-execution",
      label: "Order execution",
      status: status.orderExecution.available ? "ready" : "not_implemented",
    },
    {
      id: "portfolio-sync",
      label: "Portfolio sync",
      status: status.synchronization.available ? "ready" : "not_implemented",
    },
    {
      id: "custody",
      label: "Reconciliation",
      status: status.reconciliation.available ? "ready" : "not_implemented",
    },
    {
      id: "jobs",
      label: "Jobs",
      status: status.jobs.available ? "ready" : "not_implemented",
    },
    {
      id: "audit",
      label: "Audit",
      status: status.audit.available ? "ready" : "not_implemented",
    },
  ];
}

function TerminalSystemPage() {
  const status = Route.useLoaderData() as TerminalOpsSystemStatus;
  const env = status.environment;
  const readiness = readinessFromStatus(status);
  const search = Route.useSearch();
  const connectionState = connectionOperatorState(env);
  const attentionReadiness = readiness.filter((item) => item.status !== "ready");

  return (
    <InternalPageShell title="System">
      <div className="space-y-4">
        <Section title="Connection">
          <div className={`rounded-md border px-4 py-3 ${connectionStateTone(connectionState)}`} role="status">
            <p className="text-[13px] font-medium text-foreground/90">{connectionState}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{env.detail}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Last checked · {env.lastCheckedAt.slice(0, 19).replace("T", " ")}
            </p>
          </div>
        </Section>

        <Section title="Readiness">
          {attentionReadiness.length > 0 ? (
            <ul className="space-y-2">
              {attentionReadiness.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {terminalReadinessLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">All monitored capabilities are ready.</p>
          )}
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
              Development backlog
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {status.reconciliation.readiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
              <li>{status.recurringTrades.detail}</li>
            </ul>
          </div>
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Implementation notes
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>{status.localDatabase.detail}</li>
              <li>{status.marketData.detail}</li>
              <li>{status.orderExecution.detail}</li>
              <li>{status.synchronization.detail}</li>
              <li>{status.reconciliation.detail}</li>
              <li>{status.jobs.detail}</li>
              <li>{status.audit.detail}</li>
              <li>
                Sync, reconciliation, Terminal jobs, and recurring trades are not implemented. No
                controls are shown until those systems exist.
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
