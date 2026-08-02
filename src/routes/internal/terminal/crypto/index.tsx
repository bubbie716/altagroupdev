import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import {
  INTERNAL_TERMINAL_CRYPTO_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import {
  fetchCryptoOpsDeskSummaryFn,
  runCryptoReconciliationFn,
  type CryptoOpsActorCapabilities,
} from "@/lib/terminal/crypto/crypto-ops.functions";
import type { CryptoOpsDeskSummary } from "@/lib/terminal/crypto/crypto-ops-read.service";
import {
  cryptoOpsAttentionCta,
  cryptoOpsJobsStatusLabel,
  cryptoOpsKindLabel,
  cryptoOpsSeverityLabel,
  cryptoOpsStatusLabel,
  newCryptoOpsIdempotencyKey,
} from "@/lib/terminal/crypto/crypto-ops-ui";
import {
  formatCryptoMoney,
  formatCryptoPrice,
} from "@/lib/terminal/crypto/crypto-format";

export type TerminalCryptoDeskSearch = { site?: string; cryptoOpsScenario?: string };

export const Route = createFileRoute("/internal/terminal/crypto/")({
  validateSearch: (s: Record<string, unknown>): TerminalCryptoDeskSearch => ({
    site: validateDevSiteSearch(s).site,
    cryptoOpsScenario:
      typeof s.cryptoOpsScenario === "string" ? s.cryptoOpsScenario : undefined,
  }),
  loader: async ({ location }): Promise<{
    summary: CryptoOpsDeskSummary;
    capabilities: CryptoOpsActorCapabilities;
  }> => {
    const search = location.search as TerminalCryptoDeskSearch;
    const result = await fetchCryptoOpsDeskSummaryFn({
      data: { cryptoOpsScenario: search.cryptoOpsScenario },
    });
    if (!result.ok) {
      throw new Error(result.message || "Failed to load crypto markets");
    }
    return {
      summary: result.summary,
      capabilities: result.capabilities,
    };
  },
  head: ({ match }) => ({
    meta: [
      {
        title: internalDocumentTitle(
          "Crypto markets",
          (match.search as { site?: string }).site ?? "terminal",
        ),
      },
    ],
  }),
  component: TerminalCryptoDeskPage,
});

function money(value: string): string {
  return formatCryptoMoney(value);
}

function price(value: string, symbol?: string): string {
  return formatCryptoPrice(value, symbol);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border/70 bg-surface-1/30 px-4 py-3">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-2 text-[13px]">{children}</div>
    </section>
  );
}

function TerminalCryptoDeskPage() {
  const { summary, capabilities } = Route.useLoaderData() as {
    summary: CryptoOpsDeskSummary;
    capabilities: CryptoOpsActorCapabilities;
  };
  const search = Route.useSearch();
  const router = useRouter();
  const [reconPending, setReconPending] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [reconReason, setReconReason] = useState("");
  const [reconConfirmed, setReconConfirmed] = useState(false);
  const [showRecon, setShowRecon] = useState(false);

  const siteSearch = withInternalSiteSearch({}, search.site);

  async function runDeskReconciliation() {
    if (capabilities.uiLab || !capabilities.canReconcile) return;
    setReconPending(true);
    setReconError(null);
    try {
      const res = await runCryptoReconciliationFn({
        data: {
          reason: reconReason,
          confirmed: reconConfirmed,
          idempotencyKey: newCryptoOpsIdempotencyKey("desk-recon"),
        },
      });
      if (!res.ok) {
        setReconError(res.message);
        return;
      }
      setShowRecon(false);
      setReconReason("");
      setReconConfirmed(false);
      await router.invalidate();
    } catch (err) {
      setReconError(err instanceof Error ? err.message : "Reconciliation failed");
    } finally {
      setReconPending(false);
    }
  }

  return (
    <InternalPageShell title="Crypto markets">
      <div className="space-y-4">
        <p className="text-[13px] text-muted-foreground">
          Fictional Alta Terminal markets (NPFC, NVA, VLT) denominated in florins. Not real-world
          crypto.
        </p>

        {capabilities.uiLab ? (
          <div
            role="status"
            className="rounded-md border border-border/70 bg-surface-1/40 px-4 py-3"
          >
            <p className="text-[13px] font-medium text-foreground">Demonstration market</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Operations disabled in UI Lab. Asset lifecycle below mirrors the customer demonstration
              markets — mutations cannot activate or alter production state.
            </p>
          </div>
        ) : null}

        {summary.needsAttention.length > 0 ? (
          <Section title="Needs attention">
            <ul className="space-y-2">
              {summary.needsAttention.map((item, idx) => {
                const cta = cryptoOpsAttentionCta(item);
                return (
                  <li
                    key={`${item.kind}-${item.symbol ?? "x"}-${idx}`}
                    className="rounded border border-border/50 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13px] font-medium">
                        {item.symbol ? `${item.symbol} · ` : ""}
                        {cryptoOpsSeverityLabel(item.severity)}
                      </p>
                      {item.symbol ? (
                        <Link
                          to="/internal/terminal/crypto/$symbol"
                          params={{ symbol: item.symbol }}
                          search={withInternalSiteSearch(
                            {
                              ...INTERNAL_TERMINAL_CRYPTO_WORKSPACE_SEARCH,
                              tab: cta.tab,
                            },
                            search.site,
                          )}
                          className="inline-flex min-h-11 items-center text-[12px] text-gold hover:underline"
                        >
                          {cta.label}
                        </Link>
                      ) : (
                        <Link
                          to="/internal/terminal/crypto"
                          search={withInternalSiteSearch({}, search.site)}
                          className="inline-flex min-h-11 items-center text-[12px] text-gold hover:underline"
                        >
                          {cta.label}
                        </Link>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">{item.summary}</p>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        <Section title="Asset status">
          <div className="grid gap-2 sm:grid-cols-3">
            {summary.assets.map((asset) => (
              <Link
                key={asset.symbol}
                to="/internal/terminal/crypto/$symbol"
                params={{ symbol: asset.symbol }}
                search={withInternalSiteSearch(
                  { ...INTERNAL_TERMINAL_CRYPTO_WORKSPACE_SEARCH },
                  search.site,
                )}
                className="min-h-11 rounded border border-border/60 px-3 py-3 hover:border-border-strong"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[14px] font-medium">{asset.symbol}</span>
                  <StatusBadge status={cryptoOpsStatusLabel(asset.status, { uiLab: capabilities.uiLab })} />
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{asset.displayName}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <div>
                    <dt className="font-mono uppercase tracking-[0.1em]">Price</dt>
                    <dd className="tabular-nums text-foreground">
                      {price(asset.currentPrice, asset.symbol)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-[0.1em]">Kind</dt>
                    <dd className="text-foreground">{cryptoOpsKindLabel(asset.kind)}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-[0.1em]">Reserve</dt>
                    <dd className="tabular-nums text-foreground">{money(asset.protectedReserve)}</dd>
                  </div>
                  <div>
                    <dt className="font-mono uppercase tracking-[0.1em]">Issues</dt>
                    <dd className="tabular-nums text-foreground">
                      {asset.openCriticalIssues} critical
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
          {summary.assets.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              No crypto assets found. Apply Phase 1–4 migrations and seed launch assets.
            </p>
          ) : null}
        </Section>

        <Section title="Market integrity">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Critical issues
              </dt>
              <dd className="mt-0.5 tabular-nums">{summary.integrity.openCriticalIssueCount}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Warnings
              </dt>
              <dd className="mt-0.5 tabular-nums">{summary.integrity.openWarningIssueCount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Last reconciliation
              </dt>
              <dd className="mt-0.5 text-[12px]">
                {summary.integrity.lastReconciliationAt
                  ? `${formatActivityDateTime(summary.integrity.lastReconciliationAt)}${
                      summary.integrity.lastReconciliationStatus
                        ? ` · ${summary.integrity.lastReconciliationStatus}`
                        : ""
                    }`
                  : "Not run yet"}
              </dd>
              {summary.integrity.lastReconciliationSummary ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {summary.integrity.lastReconciliationSummary}
                </p>
              ) : null}
            </div>
          </dl>
          <div className="mt-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded border border-border px-3 text-[12px] hover:border-border-strong disabled:opacity-50"
              disabled={capabilities.uiLab || !capabilities.canReconcile}
              onClick={() => setShowRecon((v) => !v)}
            >
              Run reconciliation
            </button>
            {capabilities.uiLab ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Disabled in UI Lab — demonstration only.
              </p>
            ) : null}
            {showRecon && !capabilities.uiLab ? (
              <div className="mt-3 space-y-2 rounded border border-border/60 p-3">
                <label className="block text-[11px] text-muted-foreground">
                  Reason
                  <textarea
                    className="mt-1 min-h-[72px] w-full rounded border border-border bg-background px-3 py-2 text-[13px]"
                    value={reconReason}
                    onChange={(e) => setReconReason(e.target.value)}
                  />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={reconConfirmed}
                    onChange={(e) => setReconConfirmed(e.target.checked)}
                  />
                  I confirm this read-only reconciliation run
                </label>
                <button
                  type="button"
                  disabled={reconPending}
                  className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50 sm:w-auto sm:px-4"
                  onClick={() => void runDeskReconciliation()}
                >
                  Confirm run
                </button>
                {reconError ? <p className="text-[12px] text-destructive">{reconError}</p> : null}
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Recent operational activity">
          {summary.recentActivity.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No recent crypto ops activity.</p>
          ) : (
            <ol className="space-y-2">
              {summary.recentActivity.slice(0, 8).map((event) => (
                <li key={event.id} className="border-b border-border/40 py-2 last:border-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium">
                      {event.symbol ? `${event.symbol} · ` : ""}
                      {event.title}
                    </p>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatActivityDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{event.detail}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Jobs & readiness">
          <ul className="space-y-2">
            {summary.jobsReadiness.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
              >
                <div>
                  <p>{item.label}</p>
                  <p className="text-[12px] text-muted-foreground">{item.detail}</p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {cryptoOpsJobsStatusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted-foreground">
            System overview:{" "}
            <Link to="/internal/terminal/system" search={siteSearch} className="text-gold hover:underline">
              Terminal System
            </Link>
            .
          </p>
        </Section>
      </div>
    </InternalPageShell>
  );
}
