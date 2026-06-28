"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import {
  rejectCompanyVerificationRecord,
  revokeCompanyVerificationRecord,
  verifyCompanyRecord,
} from "@/lib/company/company.functions";
import { normalizeCompanyVerificationStatus } from "@/lib/company/verification-status";
import type { InternalCompanyRow } from "@/lib/company/types";

export function CompanyVerificationsQueueView({ companies }: { companies: InternalCompanyRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "verified" | "all">("pending");

  const queueRows = useMemo(() => {
    return companies.filter((c) => {
      const state = normalizeCompanyVerificationStatus(c.verificationStatus);
      if (statusFilter === "pending") return state === "unverified" || state === "pending";
      if (statusFilter === "verified") return state === "verified" || state === "rejected";
      return true;
    });
  }, [companies, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return queueRows;
    return queueRows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.primaryContact.toLowerCase().includes(q) ||
        (c.ticker?.toLowerCase().includes(q) ?? false),
    );
  }, [queueRows, query]);

  const pendingCount = companies.filter((c) => {
    const s = normalizeCompanyVerificationStatus(c.verificationStatus);
    return s === "unverified" || s === "pending";
  }).length;

  const columns: OpsTableColumn<InternalCompanyRow>[] = [
    {
      key: "company",
      header: "Company",
      cell: (c) => (
        <Link
          to="/internal/companies/$companyId"
          params={{ companyId: c.id }}
          className="font-medium text-[12px] hover:text-gold"
          onClick={(e) => e.stopPropagation()}
        >
          {c.name}
        </Link>
      ),
    },
    {
      key: "owner",
      header: "Primary contact",
      cell: (c) => <span className="text-[12px]">{c.primaryContact}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => <span className="text-[12px] text-muted-foreground">{c.type}</span>,
    },
    {
      key: "age",
      header: "Age",
      cell: (c) => <QueueAgeCell isoOrDate={c.lastUpdated} />,
      sortable: true,
    },
    {
      key: "submitted",
      header: "Updated",
      cell: (c) => <span className="font-mono text-[11px]">{formatQueueDate(c.lastUpdated)}</span>,
    },
    {
      key: "reps",
      header: "Reps",
      cell: (c) => <span className="tabular-nums">{c.representativeCount}</span>,
    },
    {
      key: "status",
      header: "Verification",
      cell: (c) => <OpsStatusBadge status={c.verificationStatus} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (c) => <CompanyVerificationOpsActions company={c} />,
    },
  ];

  return (
    <QueuePage
      title="Company Verifications"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search company, contact, ticker…"
      statusTabs={[
        { id: "pending", label: "Pending", count: pendingCount },
        { id: "verified", label: "Reviewed" },
        { id: "all", label: "All", count: companies.length },
      ]}
      activeStatus={statusFilter}
      onStatusChange={(id) => setStatusFilter(id as typeof statusFilter)}
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        onRowClick={(c) =>
          void router.navigate({ to: "/internal/companies/$companyId", params: { companyId: c.id } })
        }
        emptyState="No companies in this verification queue."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </span>
        }
      />
    </QueuePage>
  );
}

function CompanyVerificationOpsActions({ company }: { company: InternalCompanyRow }) {
  const state = normalizeCompanyVerificationStatus(company.verificationStatus);
  const canReview = state === "unverified" || state === "pending";
  const isVerified = state === "verified";

  if (!canReview && !isVerified) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {canReview ? (
        <>
          <OpsAction
            label="Verify"
            variant="primary"
            title="Verify company"
            description="This will mark the company as verified and enable full institutional operations."
            impact={company.name}
            confirmLabel="Confirm verification"
            onConfirm={async (reason) => {
              await verifyCompanyRecord({ data: { companyId: company.id, reviewNote: reason } });
            }}
          />
          <OpsAction
            label="Reject"
            variant="danger"
            title="Reject company verification"
            description="This will reject the verification request. The company remains unverified."
            impact={company.name}
            confirmLabel="Confirm rejection"
            onConfirm={async (reason) => {
              await rejectCompanyVerificationRecord({ data: { companyId: company.id, reviewNote: reason } });
            }}
          />
        </>
      ) : null}
      {isVerified ? (
        <OpsAction
          label="Revoke"
          variant="danger"
          title="Revoke company verification"
          description="This will revoke verified status. Representatives may lose institution-level access."
          impact={company.name}
          confirmLabel="Confirm revocation"
          onConfirm={async (reason) => {
            await revokeCompanyVerificationRecord({ data: { companyId: company.id, reviewNote: reason } });
          }}
        />
      ) : null}
    </div>
  );
}
