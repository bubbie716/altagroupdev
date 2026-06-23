import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getApiApplications } from "@/lib/internal/api";
import type { ApiApplicationRecord } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/api-applications")({
  head: () => ({ meta: [{ title: "API Applications — Alta Internal" }] }),
  component: InternalApiApplications,
});

function InternalApiApplications() {
  const applications = getApiApplications();

  return (
    <InternalPageShell
      title="Exchange API Applications"
      description="Review API access requests submitted by authorized representatives. Keys are issued to verified company entities — not to companies directly."
    >
      <Section title="Applications">
        <AdminDataTable
          columns={[
            {
              key: "id",
              header: "Ref",
              cell: (a: ApiApplicationRecord) => <span className="font-mono text-[11px]">{a.id}</span>,
            },
            {
              key: "company",
              header: "Company",
              cell: (a: ApiApplicationRecord) =>
                a.companyId ? (
                  <Link
                    to="/internal/companies/$companyId"
                    params={{ companyId: a.companyId }}
                    className="hover:text-gold"
                  >
                    {a.company}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{a.organization}</span>
                ),
            },
            {
              key: "applicant",
              header: "Applicant",
              cell: (a: ApiApplicationRecord) => <span className="font-mono text-[11px]">{a.applicant}</span>,
            },
            { key: "useCase", header: "Use Case", cell: (a: ApiApplicationRecord) => a.useCase },
            {
              key: "tier",
              header: "Tier",
              cell: (a: ApiApplicationRecord) => <span className="font-mono text-[11px]">{a.apiTier}</span>,
            },
            {
              key: "scopes",
              header: "Scopes",
              cell: (a: ApiApplicationRecord) => (
                <span className="text-[11px] leading-snug text-muted-foreground">{a.scopes.join(", ")}</span>
              ),
            },
            { key: "status", header: "Status", cell: (a: ApiApplicationRecord) => <StatusBadge status={a.status} /> },
            {
              key: "verification",
              header: "Co. Verification",
              cell: (a: ApiApplicationRecord) => <StatusBadge status={a.companyVerificationStatus} />,
            },
            {
              key: "keys",
              header: "Keys",
              cell: (a: ApiApplicationRecord) => (
                <span className="tabular font-mono text-[11px]">{a.keysIssued > 0 ? a.keysIssued : "—"}</span>
              ),
            },
            {
              key: "submitted",
              header: "Submitted",
              cell: (a: ApiApplicationRecord) => (
                <span className="font-mono text-[11px] text-muted-foreground">{a.submitted}</span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              cell: (a: ApiApplicationRecord) => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Review" />
                  {a.status !== "Approved" && <MockActionButton label="Approve" variant="primary" />}
                  {a.status === "Approved" && a.keysIssued === 0 && (
                    <MockActionButton label="Issue key" variant="primary" />
                  )}
                  {a.keysIssued > 0 && a.status !== "Revoked" && (
                    <MockActionButton label="Revoke key" variant="danger" />
                  )}
                  {a.status !== "Rejected" && a.status !== "Revoked" && (
                    <MockActionButton label="Reject" variant="danger" />
                  )}
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
