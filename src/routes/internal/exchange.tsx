import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getExchangeListings, getExchangeOpsSummary } from "@/lib/internal/api";
import { internalPreviewNotice } from "@/lib/internal/data";
import type { ExchangeListingRow } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/exchange")({
  head: () => ({ meta: [{ title: "Exchange Ops — Alta Internal" }] }),
  component: InternalExchange,
});

function InternalExchange() {
  const s = getExchangeOpsSummary();
  const listings = getExchangeListings();

  return (
    <InternalPageShell title="Exchange Operations" description="Simulated market preview for listings, notices, and API usage.">
      <p className="mb-6 text-[13px] text-muted-foreground">{internalPreviewNotice} Exchange statistics below are simulated market data.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InternalStatCard label="Listed Companies" value={String(s.listedCompanies)} sub="Simulated market" />
        <InternalStatCard label="Securities Halted" value={String(s.securitiesHalted)} alert={s.securitiesHalted > 0} sub="Simulated market" />
        <InternalStatCard label="Pending Corporate Actions" value={String(s.pendingCorporateActions)} sub="Simulated market" />
        <InternalStatCard label="Active Notices" value={String(s.activeNotices)} sub="Simulated market" />
        <InternalStatCard label="API Keys Active" value={String(s.apiKeysActive)} sub="Preview" />
        <InternalStatCard label="Pending API Applications" value="—" alert sub="Preview" />
        <InternalStatCard label="API Calls (24h)" value={s.dailyApiCalls} sub="Preview" />
      </div>

      <Section title="Market Notices" className="mt-10">
        <Card className="space-y-3 !p-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 text-[13px]">
            <span>NSX-100 quarterly rebalance — effective 2026-07-01</span>
            <StatusBadge status="Open" />
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span>MRDN trading halt — pending disclosure review</span>
            <StatusBadge status="Halted" />
          </div>
        </Card>
      </Section>

      <Section title="Listed Companies — Trading Status" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "ticker", header: "Ticker", cell: (r: ExchangeListingRow) => <span className="font-mono">{r.ticker}</span> },
            { key: "company", header: "Company", cell: (r: ExchangeListingRow) => r.company },
            { key: "sector", header: "Sector", cell: (r: ExchangeListingRow) => r.sector },
            { key: "price", header: "Last", cell: (r: ExchangeListingRow) => <span className="tabular font-mono">{r.lastPrice}</span> },
            { key: "status", header: "Trading", cell: (r: ExchangeListingRow) => <StatusBadge status={r.tradingStatus} /> },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Halt security" variant="danger" />
                  <MockActionButton label="Publish notice" />
                  <MockActionButton label="Review action" />
                </div>
              ),
            },
          ]}
          rows={listings}
          rowKey={(r) => r.ticker}
        />
      </Section>
    </InternalPageShell>
  );
}
