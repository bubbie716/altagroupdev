"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import type { InternalLoanApplicationRow } from "@/lib/bank/lending-types";
import type { AltaCardApplicationRow } from "@/lib/bank/alta-card-types";
import type { AltaCardReviewQueueRow } from "@/lib/bank/alta-card-review-types";
import { applicationListStatusLabel } from "@/lib/bank/lending-application-status-copy";
import type { LoanApplicationStatusCode } from "@/lib/bank/lending-types";
import { reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";
import type { AltaCardReviewStatusCode } from "@/lib/bank/alta-card-review-types";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";

const OPEN_LENDING_STATUSES = new Set<LoanApplicationStatusCode>(["pending", "under_review"]);
const OPEN_ALTA_CARD_APP_STATUSES = new Set(["submitted", "under_review", "needs_info"]);
const OPEN_ALTA_CARD_REVIEW_STATUSES = new Set<AltaCardReviewStatusCode>([
  "submitted",
  "under_review",
  "needs_information",
]);

export type DealRoomInboxRow = {
  id: string;
  productType: "Lending" | "Alta Card Application" | "Alta Card Review";
  customerLabel: string;
  companyLabel: string | null;
  status: string;
  waitingOn: "Alta" | "Customer" | "—";
  lastActivity: string | null;
  entityId: string;
  sortAt: string;
};

export function dealRoomRowNavigate(
  router: ReturnType<typeof import("@tanstack/react-router").useRouter>,
  row: DealRoomInboxRow,
) {
  if (row.productType === "Lending") {
    return router.navigate({
      to: "/internal/lending/applications/$applicationId",
      params: { applicationId: row.entityId },
      search: { tab: "thread" },
    });
  }
  if (row.productType === "Alta Card Application") {
    return router.navigate({
      to: "/internal/alta-card/applications/$applicationId",
      params: { applicationId: row.entityId },
      search: { tab: "thread" },
    });
  }
  return router.navigate({
    to: "/internal/alta-card/reviews/$reviewId",
    params: { reviewId: row.entityId },
    search: { tab: "thread" },
  });
}

export function buildDealRoomInboxRows(input: {
  lendingApplications: InternalLoanApplicationRow[];
  altaCardApplications: AltaCardApplicationRow[];
  altaCardReviews: AltaCardReviewQueueRow[];
}): DealRoomInboxRow[] {
  const rows: DealRoomInboxRow[] = [];

  for (const app of input.lendingApplications) {
    if (!OPEN_LENDING_STATUSES.has(app.status)) continue;
    rows.push({
      id: `lending-${app.id}`,
      productType: "Lending",
      customerLabel: app.applicantLabel,
      companyLabel: app.companyName,
      status: applicationListStatusLabel(app, "internal"),
      waitingOn: mapDealRoomWaitingOn(app.status, app.threadStatus),
      lastActivity: app.submittedAt,
      entityId: app.id,
      sortAt: app.submittedAt,
    });
  }

  for (const app of input.altaCardApplications) {
    if (!OPEN_ALTA_CARD_APP_STATUSES.has(app.status)) continue;
    rows.push({
      id: `ac-app-${app.id}`,
      productType: "Alta Card Application",
      customerLabel: app.applicantUsername,
      companyLabel: app.companyName,
      status: ALTA_CARD_APPLICATION_STATUS_LABELS[app.status],
      waitingOn: "Alta",
      lastActivity: app.updatedAt,
      entityId: app.id,
      sortAt: app.updatedAt,
    });
  }

  for (const review of input.altaCardReviews) {
    if (!OPEN_ALTA_CARD_REVIEW_STATUSES.has(review.status)) continue;
    rows.push({
      id: `ac-rev-${review.id}`,
      productType: "Alta Card Review",
      customerLabel: review.applicantUsername,
      companyLabel: review.companyName,
      status: reviewDisplayStatusLabel(review, "internal"),
      waitingOn: mapDealRoomWaitingOn(review.status, review.threadStatus),
      lastActivity: review.createdAt,
      entityId: review.id,
      sortAt: review.createdAt,
    });
  }

  return rows.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
}

function mapDealRoomWaitingOn(
  applicationStatus: string,
  threadStatus: string | null | undefined,
): DealRoomInboxRow["waitingOn"] {
  const terminalLending = applicationStatus === "approved" || applicationStatus === "denied" || applicationStatus === "cancelled";
  const terminalReview =
    applicationStatus === "approved" ||
    applicationStatus === "partially_approved" ||
    applicationStatus === "denied" ||
    applicationStatus === "cancelled";
  if (terminalLending || terminalReview) return "—";

  if (!threadStatus) {
    return applicationStatus === "pending" || applicationStatus === "submitted" ? "Alta" : "—";
  }

  const s = threadStatus.toLowerCase();
  if (s === "closed") return "—";
  if (s.includes("applicant") || s.includes("customer") || s === "waiting_on_applicant") {
    return "Customer";
  }
  if (s === "open" || s.includes("alta") || s === "waiting_on_alta") {
    return "Alta";
  }
  return "—";
}

export function DealRoomsInboxView({ rows }: { rows: DealRoomInboxRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<"all" | DealRoomInboxRow["productType"]>("all");

  const filtered = useMemo(() => {
    let list = rows;
    if (productFilter !== "all") list = list.filter((r) => r.productType === productFilter);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.customerLabel.toLowerCase().includes(q) ||
        (r.companyLabel?.toLowerCase().includes(q) ?? false) ||
        r.productType.toLowerCase().includes(q),
    );
  }, [rows, query, productFilter]);

  const columns: OpsTableColumn<DealRoomInboxRow>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{r.productType}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (r) => r.customerLabel,
    },
    {
      key: "company",
      header: "Company",
      cell: (r) => r.companyLabel ?? "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <OpsStatusBadge status={r.status} />,
    },
    {
      key: "waiting",
      header: "Waiting on",
      cell: (r) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {r.waitingOn}
        </span>
      ),
    },
    {
      key: "age",
      header: "Age",
      cell: (r) => <QueueAgeCell isoOrDate={r.sortAt} />,
      sortable: true,
    },
    {
      key: "activity",
      header: "Last activity",
      cell: (r) =>
        r.lastActivity ? (
          <span className="font-mono text-[11px]">{formatQueueDate(r.lastActivity)}</span>
        ) : (
          "—"
        ),
    },
  ];

  const lendingCount = rows.filter((r) => r.productType === "Lending").length;
  const appCount = rows.filter((r) => r.productType === "Alta Card Application").length;
  const reviewCount = rows.filter((r) => r.productType === "Alta Card Review").length;

  return (
    <QueuePage
      title="Deal Rooms"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search customer, company, product…"
      statusTabs={[
        { id: "all", label: "All", count: rows.length },
        { id: "Lending", label: "Lending", count: lendingCount },
        { id: "Alta Card Application", label: "Card apps", count: appCount },
        { id: "Alta Card Review", label: "Card reviews", count: reviewCount },
      ]}
      activeStatus={productFilter}
      onStatusChange={(id) => setProductFilter(id as typeof productFilter)}
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => void dealRoomRowNavigate(router, r)}
        emptyState="No open deal room threads."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Applicant ↔ Alta Credit Desk · {filtered.length} thread{filtered.length === 1 ? "" : "s"}
          </span>
        }
      />
    </QueuePage>
  );
}
