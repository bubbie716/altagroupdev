import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";
import type {
  AltaCardApplicationRow,
  AltaCardApplicationStatusCode,
  AltaCardTierCode,
  AltaCardTypeCode,
} from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_APPLICATION_STATUS_LABELS,
} from "@/lib/bank/alta-card-application-thread-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { fetchInternalAltaCardApplicationsFiltered } from "@/lib/bank/alta-card-application.functions";
import { fetchApplicationRelationshipSummaries } from "@/lib/internal/relationship-intelligence.functions";
import {
  ApplicationRelationshipQueueCell,
  RelationshipQueueCallout,
} from "@/components/internal/relationship-queue-cell";

export const Route = createFileRoute("/internal/alta-card/applications/")({
  loader: async () => {
    const applications = await fetchInternalAltaCardApplicationsFiltered({ data: {} });
    const summaries = await fetchApplicationRelationshipSummaries({
      data: applications.map((a) => ({
        companyId: a.companyId,
        applicantUserId: a.applicantUserId,
      })),
    });
    return { applications, summaries };
  },
  head: () => ({ meta: [{ title: "Alta Card Applications — Alta Internal" }] }),
  component: InternalAltaCardApplications,
});

function InternalAltaCardApplications() {
  const { applications: initial, summaries } = Route.useLoaderData();
  const [applications, setApplications] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<AltaCardApplicationStatusCode | "">("");
  const [typeFilter, setTypeFilter] = useState<AltaCardTypeCode | "">("");
  const [tierFilter, setTierFilter] = useState<AltaCardTierCode | "">("");
  const [q, setQ] = useState("");

  async function applyFilters() {
    const rows = await fetchInternalAltaCardApplicationsFiltered({
      data: {
        status: statusFilter || undefined,
        cardType: typeFilter || undefined,
        tier: tierFilter || undefined,
        q: q.trim() || undefined,
      },
    });
    setApplications(rows);
  }

  const columns: AdminTableColumn<AltaCardApplicationRow>[] = [
    { key: "applicant", header: "Applicant", cell: (row) => row.applicantUsername },
    { key: "company", header: "Company", cell: (row) => row.companyName ?? "—" },
    { key: "type", header: "Type", cell: (row) => row.cardType },
    { key: "tier", header: "Tier", cell: (row) => ALTA_CARD_TIER_LABELS[row.requestedTier] },
    {
      key: "status",
      header: "Status",
      cell: (row) => ALTA_CARD_APPLICATION_STATUS_LABELS[row.status],
    },
    {
      key: "created",
      header: "Submitted",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: "relationship",
      header: "Relationship",
      cell: (row) => (
        <ApplicationRelationshipQueueCell
          applicantUserId={row.applicantUserId}
          companyId={row.companyId}
          personalSummary={summaries.personal[row.applicantUserId]}
          companySummary={row.companyId ? summaries.company[row.companyId] : undefined}
        />
      ),
    },
    {
      key: "dealRoom",
      header: "",
      cell: (row) => (
        <Link
          to="/internal/alta-card/applications/$applicationId/thread"
          params={{ applicationId: row.id }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Open deal room
        </Link>
      ),
    },
    {
      key: "view",
      header: "",
      cell: (row) => (
        <Link
          to="/internal/alta-card/applications/$applicationId"
          params={{ applicationId: row.id }}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
        >
          Review →
        </Link>
      ),
    },
  ];

  return (
    <InternalPageShell
      title="Alta Card applications"
      description="Review personal and business Alta Card applications."
    >
      <Link
        to="/internal/alta-card"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Alta Card ops
      </Link>

      <RelationshipQueueCallout context="ALTA_CARD" />

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AltaCardApplicationStatusCode | "")}
          className="rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
        >
          <option value="">All statuses</option>
          {Object.entries(ALTA_CARD_APPLICATION_STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AltaCardTypeCode | "")}
          className="rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
        >
          <option value="">All types</option>
          <option value="personal">Personal</option>
          <option value="business">Business</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as AltaCardTierCode | "")}
          className="rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
        >
          <option value="">All tiers</option>
          {Object.entries(ALTA_CARD_TIER_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search applicant or company"
          className="rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
        />
        <button
          type="button"
          onClick={() => void applyFilters()}
          className="rounded border border-border bg-surface-2 px-3 py-1 text-[12px]"
        >
          Apply filters
        </button>
      </div>

      <Section title="Application queue">
        <AdminDataTable columns={columns} rows={applications} rowKey={(row) => row.id} />
      </Section>
    </InternalPageShell>
  );
}
