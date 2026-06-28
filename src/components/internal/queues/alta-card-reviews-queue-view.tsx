"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";
import { processAltaCardReviewDecision } from "@/lib/bank/alta-card-review.functions";
import { ApplicationRelationshipQueueCell } from "@/components/internal/relationship-queue-cell";
import type { AltaCardReviewQueueRow } from "@/lib/bank/alta-card-review-types";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipProfileSummary } from "@/lib/bank/company-relationship-intelligence-types";

const OPEN_REVIEW_STATUSES = new Set(["pending", "under_review", "needs_information"]);

export function AltaCardReviewsQueueView({
  reviews,
  summaries = { personal: {}, company: {} },
}: {
  reviews: AltaCardReviewQueueRow[];
  summaries?: {
    personal: Record<string, RelationshipProfileSummary>;
    company: Record<string, CompanyRelationshipProfileSummary>;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");

  const openRows = useMemo(
    () => reviews.filter((r) => OPEN_REVIEW_STATUSES.has(r.status)),
    [reviews],
  );
  const baseRows = statusFilter === "open" ? openRows : reviews;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (r) =>
        r.applicantUsername.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false) ||
        r.requestedChangesSummary.toLowerCase().includes(q),
    );
  }, [baseRows, query]);

  const columns: OpsTableColumn<AltaCardReviewQueueRow>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (row) => row.applicantUsername,
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => row.companyName ?? "—",
    },
    {
      key: "tier",
      header: "Current tier",
      cell: (row) => <span className="capitalize">{row.currentTier}</span>,
    },
    {
      key: "changes",
      header: "Requested changes",
      cell: (row) => (
        <span className="line-clamp-2 max-w-[200px] text-[12px] text-muted-foreground">
          {row.requestedChangesSummary}
        </span>
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
      cell: (row) => <OpsStatusBadge status={reviewDisplayStatusLabel(row)} />,
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
          to="/internal/alta-card/reviews/$reviewId/thread"
          params={{ reviewId: row.id }}
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
      cell: (row) => <AltaCardReviewQueueActions row={row} />,
    },
  ];

  return (
    <QueuePage
      title="Alta Card Reviews"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search customer, company, changes…"
      statusTabs={[
        { id: "open", label: "Open", count: openRows.length },
        { id: "all", label: "All", count: reviews.length },
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
            to: "/internal/alta-card/reviews/$reviewId",
            params: { reviewId: row.id },
          })
        }
        emptyState="No Alta Card account reviews in this queue."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"} · Full decisions on review detail
          </span>
        }
      />
    </QueuePage>
  );
}

function AltaCardReviewQueueActions({ row }: { row: AltaCardReviewQueueRow }) {
  if (!OPEN_REVIEW_STATUSES.has(row.status)) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      <OpsAction
        label="Deny"
        variant="danger"
        title="Deny account review"
        description="This will deny the requested changes and close the review."
        impact={row.requestedChangesSummary}
        confirmLabel="Confirm denial"
        onConfirm={async (reason) => {
          await processAltaCardReviewDecision({
            data: { reviewId: row.id, action: "deny", reason },
          });
        }}
      />
      <OpsAction
        label="Close"
        title="Close review"
        description="Cancel this review without approving changes."
        impact={row.applicantUsername}
        confirmLabel="Close review"
        onConfirm={async (reason) => {
          await processAltaCardReviewDecision({
            data: { reviewId: row.id, action: "cancel", reason },
          });
        }}
      />
      <Link
        to="/internal/alta-card/reviews/$reviewId"
        params={{ reviewId: row.id }}
        className="self-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
        onClick={(e) => e.stopPropagation()}
      >
        Decide →
      </Link>
    </div>
  );
}
