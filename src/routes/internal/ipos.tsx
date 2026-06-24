import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getIpoApplications } from "@/lib/internal/api";
import type { IpoApplication } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/ipos")({
  head: () => ({ meta: [{ title: "IPO Applications — Alta Internal" }] }),
  component: InternalIpos,
});

function InternalIpos() {
  const applications = getIpoApplications();

  return (
    <InternalPageShell
      title="IPO Application Review"
      description="Applications are tied to registered company entities. Review representatives and documentation before approval."
    >
      <Section title="Applications">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (a: IpoApplication) => <span className="font-mono text-[11px]">{a.id}</span> },
            {
              key: "company",
              header: "Company",
              cell: (a: IpoApplication) => (
                <Link
                  to="/internal/companies/$companyId"
                  params={{ companyId: a.companyId }}
                  className="hover:text-gold"
                >
                  {a.company}
                </Link>
              ),
            },
            { key: "ticker", header: "Ticker", cell: (a: IpoApplication) => <span className="font-mono">{a.ticker}</span> },
            { key: "sector", header: "Sector", cell: (a: IpoApplication) => a.sector },
            { key: "raise", header: "Raise", cell: (a: IpoApplication) => <span className="type-finance">{a.raiseSize}</span> },
            { key: "status", header: "App Status", cell: (a: IpoApplication) => <StatusBadge status={a.status} /> },
            { key: "verification", header: "Co. Verification", cell: (a: IpoApplication) => <StatusBadge status={a.companyVerificationStatus} /> },
            { key: "rep", header: "Authorized Rep.", cell: (a: IpoApplication) => <span className="font-mono text-[11px]">{a.authorizedRepresentative}</span> },
            { key: "docs", header: "Documents", cell: (a: IpoApplication) => <StatusBadge status={a.documentsReceived} /> },
            { key: "board", header: "Board Approval", cell: (a: IpoApplication) => <StatusBadge status={a.boardApprovalStatus} /> },
            { key: "submitted", header: "Submitted", cell: (a: IpoApplication) => <span className="font-mono text-[11px] text-muted-foreground">{a.submitted}</span> },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Review" />
                  <MockActionButton label="Approve" variant="primary" />
                  <MockActionButton label="Reject" variant="danger" />
                  <MockActionButton label="Request info" />
                </div>
              ),
            },
          ]}
          rows={applications}
          rowKey={(a) => a.id}
        />
      </Section>
    </InternalPageShell>
  );
}
