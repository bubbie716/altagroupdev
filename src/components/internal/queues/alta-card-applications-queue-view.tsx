"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { INTERNAL_ALTA_CARD_APPLICATION_SEARCH } from "@/lib/internal/internal-route-search";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { florin } from "@/lib/bank/api";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { denyAltaCardApplicationRecord } from "@/lib/bank/alta-card.functions";
import { ApplicationRelationshipQueueCell } from "@/components/internal/relationship-queue-cell";
import type { AltaCardApplicationRow } from "@/lib/bank/alta-card-types";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipProfileSummary } from "@/lib/bank/company-relationship-intelligence-types";

const OPEN_STATUSES = new Set(["submitted", "under_review", "needs_info"]);

export function AltaCardApplicationsQueueView({
  applications,
  summaries = { personal: {}, company: {} },
}: {
  applications: AltaCardApplicationRow[];
  summaries?: {
    personal: Record<string, RelationshipProfileSummary>;
    company: Record<string, CompanyRelationshipProfileSummary>;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");

  const openRows = useMemo(
    () => applications.filter((a) => OPEN_STATUSES.has(a.status)),
    [applications],
  );
  const baseRows = statusFilter === "open" ? openRows : applications;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (a) =>
        a.applicantUsername.toLowerCase().includes(q) ||
        (a.companyName?.toLowerCase().includes(q) ?? false),
    );
  }, [baseRows, query]);

  const columns: OpsTableColumn<AltaCardApplicationRow>[] = [
    {
      key: "applicant",
      header: "Applicant",
      cell: (row) => row.applicantUsername,
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => row.companyName ?? "—",
    },
    {
      key: "tier",
      header: "Requested tier",
      cell: (row) => ALTA_CARD_TIER_LABELS[row.requestedTier],
    },
    {
      key: "limit",
      header: "Requested limit",
      cell: (row) =>
        row.requestedLimit != null ? (
          <span className="type-finance tabular-nums">{florin(row.requestedLimit)}</span>
        ) : (
          "—"
        ),
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
      key: "status",
      header: "Status",
      cell: (row) => <OpsStatusBadge status={ALTA_CARD_APPLICATION_STATUS_LABELS[row.status]} />,
    },
    {
      key: "age",
      header: "Age",
      cell: (row) => <QueueAgeCell isoOrDate={row.createdAt} />,
      sortable: true,
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (row) => (
        <span className="font-mono text-[11px]">{formatQueueDate(row.createdAt)}</span>
      ),
    },
    {
      key: "thread",
      header: "Thread",
      cell: (row) => (
        <Link
          to="/internal/alta-card/applications/$applicationId/thread"
          params={{ applicationId: row.id }}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open thread
        </Link>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => <AltaCardApplicationQueueActions row={row} />,
    },
  ];

  return (
    <QueuePage
      title="Alta Card Applications"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search applicant, company…"
      statusTabs={[
        { id: "open", label: "Open", count: openRows.length },
        { id: "all", label: "All", count: applications.length },
      ]}
      activeStatus={statusFilter}
      onStatusChange={(id) => setStatusFilter(id as typeof statusFilter)}
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          void router.navigate({
            to: "/internal/alta-card/applications/$applicationId",
            params: { applicationId: row.id },
            search: INTERNAL_ALTA_CARD_APPLICATION_SEARCH,
          })
        }
        emptyState="No Alta Card applications in this queue."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"} · Approve from application detail
          </span>
        }
      />
    </QueuePage>
  );
}

function AltaCardApplicationQueueActions({ row }: { row: AltaCardApplicationRow }) {
  if (!OPEN_STATUSES.has(row.status)) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      <OpsAction
        label="Deny"
        variant="danger"
        title="Deny Alta Card application"
        description="This will reject the application. No card will be issued."
        impact={`${row.applicantUsername} · ${ALTA_CARD_TIER_LABELS[row.requestedTier]}`}
        confirmLabel="Confirm denial"
        onConfirm={async (reason) => {
          await denyAltaCardApplicationRecord({
            data: { applicationId: row.id, denialReason: reason },
          });
        }}
      />
      <Link
        to="/internal/alta-card/applications/$applicationId"
        params={{ applicationId: row.id }}
        search={INTERNAL_ALTA_CARD_APPLICATION_SEARCH}
        className="self-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
        onClick={(e) => e.stopPropagation()}
      >
        Approve →
      </Link>
    </div>
  );
}
