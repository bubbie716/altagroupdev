"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { florin } from "@/lib/bank/api";
import { applicationListStatusLabel } from "@/lib/bank/loan-application-thread-types";
import {
  denyLoanApplicationRecord,
  markLoanApplicationUnderReviewRecord,
} from "@/lib/bank/lending.functions";
import { ensureInternalLoanApplicationThread } from "@/lib/bank/loan-application-thread.functions";
import { ApplicationRelationshipQueueCell } from "@/components/internal/relationship-queue-cell";
import type { InternalLoanApplicationRow } from "@/lib/bank/lending-types";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipProfileSummary } from "@/lib/bank/company-relationship-intelligence-types";

export function LendingApplicationsQueueView({
  applications,
  summaries = { personal: {}, company: {} },
}: {
  applications: InternalLoanApplicationRow[];
  summaries?: {
    personal: Record<string, RelationshipProfileSummary>;
    company: Record<string, CompanyRelationshipProfileSummary>;
  };
}) {
  const router = useRouter();
  const openThread = useServerFn(ensureInternalLoanApplicationThread);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");

  const openRows = useMemo(
    () => applications.filter((a) => a.status === "pending" || a.status === "under_review"),
    [applications],
  );

  const baseRows = statusFilter === "open" ? openRows : applications;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (a) =>
        a.applicantLabel.toLowerCase().includes(q) ||
        a.productLabel.toLowerCase().includes(q) ||
        (a.companyName?.toLowerCase().includes(q) ?? false),
    );
  }, [baseRows, query]);

  const columns: OpsTableColumn<InternalLoanApplicationRow>[] = [
    {
      key: "applicant",
      header: "Applicant",
      cell: (row) => <span className="font-mono text-[11px]">{row.applicantLabel}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (row) => row.companyName ?? "—",
    },
    {
      key: "product",
      header: "Product",
      cell: (row) => row.productLabel,
    },
    {
      key: "amount",
      header: "Requested",
      cell: (row) => <span className="type-finance tabular-nums">{florin(row.requestedAmount)}</span>,
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
      cell: (row) => <OpsStatusBadge status={applicationListStatusLabel(row, "internal")} />,
    },
    {
      key: "age",
      header: "Age",
      cell: (row) => <QueueAgeCell isoOrDate={row.submittedAt} />,
      sortable: true,
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (row) => (
        <span className="font-mono text-[11px]">{formatQueueDate(row.submittedAt)}</span>
      ),
    },
    {
      key: "thread",
      header: "Deal room",
      cell: (row) => (
        <DealRoomLink row={row} onOpenThread={openThread} router={router} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => <LendingQueueActions row={row} />,
    },
  ];

  return (
    <QueuePage
      title="Lending Applications"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search applicant, company, product…"
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
            to: "/internal/lending/applications/$applicationId/thread",
            params: { applicationId: row.id },
          })
        }
        emptyState="No lending applications in this queue."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"} · Accept applications from the deal room or application detail
          </span>
        }
      />
    </QueuePage>
  );
}

function DealRoomLink({
  row,
  onOpenThread,
  router,
}: {
  row: InternalLoanApplicationRow;
  onOpenThread: ReturnType<typeof useServerFn<typeof ensureInternalLoanApplicationThread>>;
  router: ReturnType<typeof useRouter>;
}) {
  const [pending, setPending] = useState(false);

  if (row.threadId) {
    return (
      <Link
        to="/internal/lending/applications/$applicationId/thread"
        params={{ applicationId: row.id }}
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Open thread
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline disabled:opacity-50"
      onClick={async (e) => {
        e.stopPropagation();
        setPending(true);
        try {
          await onOpenThread({ data: row.id });
          await router.navigate({
            to: "/internal/lending/applications/$applicationId/thread",
            params: { applicationId: row.id },
          });
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Opening…" : "Open thread"}
    </button>
  );
}

function LendingQueueActions({ row }: { row: InternalLoanApplicationRow }) {
  const actionable = row.status === "pending" || row.status === "under_review";
  if (!actionable) return <span className="text-[11px] text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {row.status === "pending" ? (
        <OpsAction
          label="Begin review"
          title="Begin lending review"
          description="Marks the application under review and notifies the applicant in the deal room."
          impact={`${row.applicantLabel} · ${florin(row.requestedAmount)}`}
          onConfirm={async (reason) => {
            await markLoanApplicationUnderReviewRecord({
              data: { applicationId: row.id, reviewNote: reason },
            });
          }}
        />
      ) : null}
      <OpsAction
        label="Deny"
        variant="danger"
        title="Deny lending application"
        description="This will reject the application. No loan will be originated."
        impact={`${row.productLabel} · ${florin(row.requestedAmount)}`}
        confirmLabel="Confirm denial"
        onConfirm={async (reason) => {
          await denyLoanApplicationRecord({
            data: { applicationId: row.id, reviewNote: reason },
          });
        }}
      />
      <Link
        to="/internal/lending/applications/$applicationId/thread"
        params={{ applicationId: row.id }}
        className="self-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold"
        onClick={(e) => e.stopPropagation()}
      >
        Accept →
      </Link>
    </div>
  );
}
