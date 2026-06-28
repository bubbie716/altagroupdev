import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { CompanyVerificationActions } from "@/components/internal/company-verification-actions";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { fetchInternalCompaniesFromDb } from "@/lib/company/company.functions";
import type { InternalCompanyRow } from "@/lib/company/types";

export const Route = createFileRoute("/internal/companies/")({
  loader: async () => {
    try {
      return await fetchInternalCompaniesFromDb();
    } catch {
      // TODO: remove fallback once internal portal is fully DB-backed.
      const { getCompanyAccounts } = await import("@/lib/internal/api");
      return getCompanyAccounts().map((c) => ({
        id: c.id,
        name: c.name,
        ticker: c.ticker,
        type: c.type,
        sector: c.sector,
        status: c.status,
        verificationStatus: c.verificationStatus,
        representativeCount: c.representativeCount,
        primaryContact: c.primaryContact,
        lastUpdated: c.lastUpdated,
      })) satisfies InternalCompanyRow[];
    }
  },
  head: () => ({ meta: [{ title: "Companies — Alta Internal" }] }),
  component: InternalCompanies,
});

function InternalCompanies() {
  const companies = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Companies"
      breadcrumbs={buildBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Companies" },
      ])}
    >
      <OpsSection title={`Registered entities (${companies.length})`}>
        <AdminDataTable
          columns={[
            {
              key: "name",
              header: "Company",
              cell: (c: InternalCompanyRow) => (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: c.id }}
                  className="font-medium hover:text-gold"
                >
                  {c.name}
                </Link>
              ),
            },
            {
              key: "ticker",
              header: "Ticker",
              cell: (c: InternalCompanyRow) =>
                c.ticker ? <span className="font-mono">{c.ticker}</span> : <span className="text-muted-foreground">—</span>,
            },
            { key: "type", header: "Type", cell: (c: InternalCompanyRow) => <span className="text-[12px]">{c.type}</span> },
            { key: "sector", header: "Sector", cell: (c: InternalCompanyRow) => c.sector ?? "—" },
            { key: "status", header: "Status", cell: (c: InternalCompanyRow) => <StatusBadge status={c.status} /> },
            {
              key: "reps",
              header: "Representatives",
              cell: (c: InternalCompanyRow) => <span className="type-finance">{c.representativeCount}</span>,
            },
            { key: "contact", header: "Primary Contact", cell: (c: InternalCompanyRow) => <span className="font-mono text-[12px]">{c.primaryContact}</span> },
            { key: "verification", header: "Verification", cell: (c: InternalCompanyRow) => <StatusBadge status={c.verificationStatus} /> },
            { key: "updated", header: "Last Updated", cell: (c: InternalCompanyRow) => <span className="font-mono text-[11px] text-muted-foreground">{c.lastUpdated}</span> },
            {
              key: "actions",
              header: "Actions",
              cell: (c: InternalCompanyRow) => (
                <CompanyVerificationActions
                  companyId={c.id}
                  verificationStatus={c.verificationStatus}
                  companyName={c.name}
                />
              ),
            },
          ]}
          rows={companies}
          rowKey={(c) => c.id}
          emptyState="No companies registered."
        />
      </OpsSection>
    </InternalPageShell>
  );
}
