import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getListingRecords } from "@/lib/internal/api";
import type { ListingRecord } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/listings")({
  head: () => ({ meta: [{ title: "Listings — Alta Internal" }] }),
  component: InternalListings,
});

function InternalListings() {
  const listings = getListingRecords();

  return (
    <InternalPageShell title="Listed Company Management" description="Active listings, filings, and compliance posture.">
      <Section title="Listings">
        <AdminDataTable
          columns={[
            { key: "ticker", header: "Ticker", cell: (l: ListingRecord) => <span className="font-mono">{l.ticker}</span> },
            { key: "company", header: "Company", cell: (l: ListingRecord) => l.company },
            { key: "sector", header: "Sector", cell: (l: ListingRecord) => l.sector },
            { key: "mcap", header: "Market Cap", cell: (l: ListingRecord) => <span className="type-finance">{l.marketCap}</span> },
            { key: "status", header: "Status", cell: (l: ListingRecord) => <StatusBadge status={l.status} /> },
            { key: "filing", header: "Last Filing", cell: (l: ListingRecord) => <span className="font-mono text-[11px] text-muted-foreground">{l.lastFiling}</span> },
            { key: "compliance", header: "Compliance", cell: (l: ListingRecord) => <StatusBadge status={l.complianceStatus} /> },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="View profile" />
                  <MockActionButton label="Suspend" variant="danger" />
                  <MockActionButton label="Request filing" />
                  <MockActionButton label="Edit listing" />
                </div>
              ),
            },
          ]}
          rows={listings}
          rowKey={(l) => l.ticker}
        />
      </Section>
    </InternalPageShell>
  );
}
