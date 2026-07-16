"use client";

import { Link } from "@tanstack/react-router";
import type { PortalSettlementDetail } from "@/lib/ncc/portal-types";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  PortalStatusBadge,
  formatPortalDate,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";

function TimelineItem({
  label,
  at,
  active,
}: {
  label: string;
  at: string | null;
  active?: boolean;
}) {
  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-1.5 size-2.5 rounded-full border ${
          at || active
            ? "border-[#0c4d32] bg-[#0c4d32]"
            : "border-[#d1d5db] bg-white"
        }`}
      />
      <div className="text-[12px] font-medium text-[#111827]">{label}</div>
      <div className="text-[11px] text-[#6b7280]">{formatPortalDate(at)}</div>
    </li>
  );
}

export function PortalSettlementDetailView({ detail }: { detail: PortalSettlementDetail }) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Settlement Instruction"
        title={detail.publicReference}
        description="Lifecycle, ledger, and audit detail for this settlement instruction."
        actions={
          <Link
            to="/portal/queue"
            search={{ status: undefined, q: undefined }}
            className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            Back to queue
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <PortalStatusBadge status={detail.status} kind="settlement" />
            <span className="text-[13px] text-[#6b7280]">Stage: {detail.stage}</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                Amount
              </div>
              <div className="mt-1 text-[22px] font-semibold tabular-nums text-[#111827]">
                {formatPortalMoney(detail.amount, detail.currency)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                Currency
              </div>
              <div className="mt-1 text-[15px] font-medium">{detail.currency}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                Sending Institution
              </div>
              <div className="mt-1 text-[13px] font-medium">{detail.sendingInstitutionName}</div>
              <div className="text-[12px] text-[#6b7280]">{detail.sendingRoutingNumber}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                Receiving Institution
              </div>
              <div className="mt-1 text-[13px] font-medium">{detail.receivingInstitutionName}</div>
              <div className="text-[12px] text-[#6b7280]">{detail.receivingRoutingNumber}</div>
            </div>
          </div>

          {(detail.failureCode || detail.failureReason || detail.manualReviewReason) && (
            <div className="mt-4 rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b91c1c]">
                Failure information
              </div>
              <div className="mt-1 text-[13px] text-[#7f1d1d]">
                {detail.failureCode ? `${detail.failureCode}: ` : ""}
                {detail.failureReason ?? detail.manualReviewReason ?? "Unknown failure"}
              </div>
              {detail.manualReviewReason ? (
                <div className="mt-1 text-[12px] text-[#991b1b]">
                  Manual review: {detail.manualReviewReason}
                </div>
              ) : null}
            </div>
          )}

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-[12px]">
            <div>
              <dt className="text-[#6b7280]">Idempotency key</dt>
              <dd className="mt-1 break-all font-mono text-[11px]">{detail.idempotencyKey}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">External reference</dt>
              <dd className="mt-1">{detail.externalReference ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Purpose</dt>
              <dd className="mt-1">{detail.purpose ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Submitted by</dt>
              <dd className="mt-1">{detail.submittedByUserId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Execution</dt>
              <dd className="mt-1">{detail.executionStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Compensation</dt>
              <dd className="mt-1">
                {detail.compensationStatus ?? (detail.compensationEligible ? "Eligible" : "—")}
              </dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Outbox failures</dt>
              <dd className="mt-1">{detail.outboxFailureCount}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Reconciliation</dt>
              <dd className="mt-1">{detail.reconciliationStatus ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Lifecycle timeline
          </h2>
          <ol className="relative mt-4 space-y-4 border-l border-[#e5e7eb] ml-1">
            <TimelineItem label="Created" at={detail.createdAt} />
            <TimelineItem label="Submitted" at={detail.submittedAt} />
            <TimelineItem label="Validated" at={detail.validatedAt} />
            <TimelineItem label="Settled" at={detail.settledAt} />
            <TimelineItem label="Failed" at={detail.failedAt} />
            <TimelineItem label="Cancelled" at={detail.cancelledAt} />
            <TimelineItem label="Reversed" at={detail.reversedAt} />
          </ol>
        </section>
      </div>

      {detail.compensation ? (
        <section className="mt-4 rounded-sm border border-[#fde68a] bg-[#fffbeb] p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#92400e]">
            Compensation
          </h2>
          <p className="mt-2 text-[13px] text-[#78350f]">
            {detail.compensation.reason} · {formatPortalDate(detail.compensation.createdAt)}
          </p>
          <p className="mt-1 text-[12px] text-[#92400e]">
            Source restore: {detail.compensation.sourceRestoreReference ?? "—"}
          </p>
        </section>
      ) : null}

      {detail.reversal ? (
        <section className="mt-4 rounded-sm border border-[#ddd6fe] bg-[#f5f3ff] p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6d28d9]">
            Reversal history
          </h2>
          <p className="mt-2 text-[13px] text-[#4c1d95]">
            {detail.reversal.reason} · {formatPortalDate(detail.reversal.createdAt)}
          </p>
          <p className="mt-1 text-[12px] text-[#6d28d9]">
            Reversal instruction: {detail.reversal.reversalInstructionId}
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
          Ledger entries
        </h2>
        <PortalEnterpriseTable
          rows={detail.entries}
          emptyTitle="No ledger entries"
          emptyDescription="Ledger postings will appear once settlement processing begins."
          columns={[
            {
              key: "type",
              header: "Type",
              render: (row) => row.entryType,
            },
            {
              key: "amount",
              header: "Amount",
              className: "tabular-nums",
              render: (row) => formatPortalMoney(row.amount, row.currency),
            },
            {
              key: "before",
              header: "Balance before",
              className: "tabular-nums",
              render: (row) => formatPortalMoney(row.balanceBefore, row.currency),
            },
            {
              key: "after",
              header: "Balance after",
              className: "tabular-nums",
              render: (row) => formatPortalMoney(row.balanceAfter, row.currency),
            },
            {
              key: "time",
              header: "Posted",
              render: (row) => formatPortalDate(row.createdAt),
            },
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
          Audit events
        </h2>
        <PortalEnterpriseTable
          rows={detail.auditEvents}
          emptyTitle="No audit events"
          emptyDescription="Audit events for this instruction will appear here."
          columns={[
            {
              key: "time",
              header: "Time",
              render: (row) => formatPortalDate(row.createdAt),
            },
            {
              key: "actor",
              header: "Actor",
              render: (row) => row.actorUsername,
            },
            {
              key: "action",
              header: "Action",
              render: (row) => row.action,
            },
            {
              key: "desc",
              header: "Detail",
              render: (row) => row.description,
            },
          ]}
        />
      </section>
    </div>
  );
}
