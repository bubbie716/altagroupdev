import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { ComplianceBadge } from "@/components/internal/compliance-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getComplianceCases } from "@/lib/internal/api";
import type { ComplianceCase } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Alta Internal" }] }),
  component: InternalCompliance,
});

function InternalCompliance() {
  const cases = getComplianceCases();

  return (
    <InternalPageShell title="Compliance" description="Open cases, conduct flags, and escalation queue.">
      <Section title="Compliance Cases">
        <AdminDataTable
          columns={[
            { key: "id", header: "Case", cell: (c: ComplianceCase) => <span className="font-mono text-[11px]">{c.id}</span> },
            { key: "title", header: "Title", cell: (c: ComplianceCase) => c.title },
            { key: "category", header: "Category", cell: (c: ComplianceCase) => <span className="text-[12px] text-muted-foreground">{c.category}</span> },
            { key: "severity", header: "Severity", cell: (c: ComplianceCase) => <ComplianceBadge severity={c.severity} /> },
            { key: "status", header: "Status", cell: (c: ComplianceCase) => <StatusBadge status={c.status} /> },
            { key: "assignee", header: "Assignee", cell: (c: ComplianceCase) => <span className="font-mono text-[11px]">{c.assignee}</span> },
            { key: "opened", header: "Opened", cell: (c: ComplianceCase) => <span className="font-mono text-[11px] text-muted-foreground">{c.opened}</span> },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Open case" />
                  <MockActionButton label="Assign" />
                  <MockActionButton label="Resolve" variant="primary" />
                  <MockActionButton label="Escalate" variant="danger" />
                </div>
              ),
            },
          ]}
          rows={cases}
          rowKey={(c) => c.id}
        />
      </Section>
    </InternalPageShell>
  );
}
