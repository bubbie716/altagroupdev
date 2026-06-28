import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type {
  AltaCardApplicationRow,
  AltaCardFeeRow,
  AltaCardRow,
  AltaCardStatementRow,
  AltaCardStatusCode,
  AltaCardTierCode,
  AltaCardTypeCode,
} from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_FEE_STATUS_LABELS,
  ALTA_CARD_FEE_TYPE_LABELS,
  ALTA_CARD_STATEMENT_STATUS_LABELS_ADMIN,
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";
import {
  approveAltaCardApplicationRecord,
  denyAltaCardApplicationRecord,
} from "@/lib/bank/alta-card.functions";
import {
  generateAltaCardStatementRecord,
  regenerateOpenAltaCardStatementRecord,
  voidAltaCardStatementRecord,
} from "@/lib/bank/alta-card-statement.functions";
import {
  applyAltaCardInterestBatchRecord,
  applyAltaCardStatementInterestRecord,
  previewAltaCardStatementInterestRecord,
  runAltaCardBillingProcessRecord,
  waiveAltaCardFeeRecord,
} from "@/lib/bank/alta-card-interest.functions";
import { AltaCardStatementList } from "@/components/bank/alta-card/alta-card-statement-views";
import { AltaCardStatementGenerateForm } from "@/components/bank/alta-card/alta-card-statement-generate-form";
import { ALTA_CARD_BILLING_POLICY_LINES } from "@/lib/bank/alta-card-billing-cycle";

function cardColumns(): AdminTableColumn<AltaCardRow>[] {
  return [
    {
      key: "holder",
      header: "Holder",
      cell: (row) => row.ownerUsername ?? row.companyName ?? "—",
    },
    { key: "type", header: "Type", cell: (row) => row.cardType },
    { key: "tier", header: "Tier", cell: (row) => ALTA_CARD_TIER_LABELS[row.tier] },
    { key: "status", header: "Status", cell: (row) => altaCardStatusLabel(row.status) },
    {
      key: "limit",
      header: "Limit",
      cell: (row) => formatAltaCardCurrency(row.creditLimit),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (row) => formatAltaCardCurrency(row.currentBalance),
    },
    {
      key: "detail",
      header: "",
      cell: (row) => (
        <Link
          to="/internal/alta-card/$cardId"
          params={{ cardId: row.id }}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
        >
          Manage →
        </Link>
      ),
    },
  ];
}

function ApplicationActions({
  application,
  onRefresh,
}: {
  application: AltaCardApplicationRow;
  onRefresh: () => Promise<void>;
}) {
  const [limit, setLimit] = useState(
    String(application.requestedLimit ?? application.approvedLimit ?? 5000),
  );
  const [rate, setRate] = useState(String(application.approvedInterestRate ?? 19.99));

  if (!["submitted", "under_review", "needs_info"].includes(application.status)) {
    return <span className="text-[12px] text-muted-foreground">{application.status}</span>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:min-w-[220px]">
      <input
        type="number"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[12px]"
        placeholder="Limit"
      />
      <input
        type="number"
        step="0.01"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        className="rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[12px]"
        placeholder="Rate %"
      />
      <div className="flex flex-wrap gap-1">
        <BankReviewButton
          label="Approve"
          variant="primary"
          onAction={async () => {
            await approveAltaCardApplicationRecord({
              data: {
                applicationId: application.id,
                approvedLimit: Number(limit),
                interestRate: Number(rate),
              },
            });
            await onRefresh();
          }}
        />
        <BankReviewButton
          label="Deny"
          variant="danger"
          onAction={async () => {
            await denyAltaCardApplicationRecord({
              data: { applicationId: application.id },
            });
            await onRefresh();
          }}
        />
      </div>
    </div>
  );
}

function applicationColumns(onRefresh: () => Promise<void>): AdminTableColumn<AltaCardApplicationRow>[] {
  return [
    { key: "applicant", header: "Applicant", cell: (row) => row.applicantUsername },
    { key: "company", header: "Company", cell: (row) => row.companyName ?? "—" },
    { key: "type", header: "Type", cell: (row) => row.cardType },
    { key: "tier", header: "Tier", cell: (row) => ALTA_CARD_TIER_LABELS[row.requestedTier] },
    { key: "status", header: "Status", cell: (row) => row.status },
    {
      key: "actions",
      header: "Review",
      cell: (row) => <ApplicationActions application={row} onRefresh={onRefresh} />,
    },
  ];
}

export function InternalAltaCardPanel({
  cards,
  applications,
  onRefresh,
}: {
  cards: AltaCardRow[];
  applications: AltaCardApplicationRow[];
  onRefresh: () => Promise<void>;
}) {
  const [tierFilter, setTierFilter] = useState<AltaCardTierCode | "">("");
  const [statusFilter, setStatusFilter] = useState<AltaCardStatusCode | "">("");
  const [typeFilter, setTypeFilter] = useState<AltaCardTypeCode | "">("");

  const filtered = cards.filter((c) => {
    if (tierFilter && c.tier !== tierFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (typeFilter && c.cardType !== typeFilter) return false;
    return true;
  });

  const pendingApplications = applications.filter((a) =>
    ["submitted", "under_review", "needs_info"].includes(a.status),
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-2">
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AltaCardStatusCode | "")}
          className="rounded border border-border bg-surface-1 px-2 py-1 text-[12px]"
        >
          <option value="">All statuses</option>
          {(["pending", "active", "frozen", "closed", "delinquent", "lost"] as AltaCardStatusCode[]).map(
            (s) => (
              <option key={s} value={s}>
                {altaCardStatusLabel(s)}
              </option>
            ),
          )}
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
        <Link
          to="/internal/alta-card/applications"
          className="rounded border border-border bg-surface-2 px-3 py-1 text-[12px]"
        >
          Applications ({pendingApplications.length} pending)
        </Link>
        <Link
          to="/internal/alta-card/reviews"
          className="rounded border border-border bg-surface-2 px-3 py-1 text-[12px]"
        >
          Account reviews
        </Link>
      </div>

      <AdminDataTable columns={cardColumns()} rows={filtered} rowKey={(row) => row.id} />

      <div>
        <h3 className="mb-4 font-serif text-[18px]">Pending applications</h3>
        <AdminDataTable
          columns={applicationColumns(onRefresh)}
          rows={pendingApplications}
          rowKey={(row) => row.id}
        />
      </div>
    </div>
  );
}

/** Billing-only panel — financial mutations live in InternalAltaCardOpsPanel. */
export function InternalAltaCardDetailPanel({
  card,
  statements = [],
  fees = [],
  onRefresh,
}: {
  card: import("@/lib/bank/alta-card-types").AltaCardDetail;
  statements?: AltaCardStatementRow[];
  fees?: AltaCardFeeRow[];
  onRefresh: () => Promise<void>;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const [interestPreview, setInterestPreview] = useState<string | null>(null);
  const [feeWaiveReason, setFeeWaiveReason] = useState("");

  const overdueStatements = statements.filter((s) => s.status === "overdue");
  const unpaidStatements = statements.filter(
    (s) => s.status === "issued" || s.status === "partially_paid" || s.status === "overdue",
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-serif text-[18px]">Billing & statements</h3>
        <div className="rounded-lg border border-border/60 bg-surface-2/40 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Billing policy (V1)
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-muted-foreground">
            {ALTA_CARD_BILLING_POLICY_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Cycle:{" "}
          {card.currentBillingCycleStart && card.currentBillingCycleEnd
            ? `${new Date(card.currentBillingCycleStart).toLocaleDateString()} – ${new Date(card.currentBillingCycleEnd).toLocaleDateString()}`
            : "—"}
          {" · "}
          Next statement:{" "}
          {card.nextStatementDate ? new Date(card.nextStatementDate).toLocaleDateString() : "—"}
          {" · "}
          Payment due:{" "}
          {card.paymentDueDate ? new Date(card.paymentDueDate).toLocaleDateString() : "—"}
        </p>
        <div className="flex flex-wrap gap-2">
          <BankReviewButton
            label="Close billing cycle (issue statement)"
            variant="primary"
            onAction={async () => {
              await generateAltaCardStatementRecord({ data: card.id });
              await onRefresh();
            }}
          />
          <BankReviewButton
            label="Regenerate open cycle"
            onAction={async () => {
              await regenerateOpenAltaCardStatementRecord({ data: card.id });
              await onRefresh();
            }}
          />
        </div>
        <div className="rounded-lg border border-dashed border-border/70 bg-surface-2/20 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Preview statement (admin only)
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Preview statements do not trigger billing, interest, or due dates.
          </p>
          <div className="mt-4">
            <AltaCardStatementGenerateForm cardId={card.id} card={card} />
          </div>
        </div>
        <AltaCardStatementList
          cardId={card.id}
          card={card}
          statements={statements}
          variant="admin"
          statusLabels={ALTA_CARD_STATEMENT_STATUS_LABELS_ADMIN}
        />
        {statements
          .filter((s) => s.status === "issued" || s.status === "partially_paid")
          .map((s) => (
            <BankReviewButton
              key={s.id}
              label={`Void #${s.statementNumber}`}
              variant="danger"
              onAction={async () => {
                await voidAltaCardStatementRecord({ data: s.id });
                await onRefresh();
              }}
            />
          ))}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-serif text-[18px]">Interest & fees</h3>
        {overdueStatements.length > 0 ? (
          <p className="text-[13px] text-amber-700 dark:text-amber-400">
            {overdueStatements.length} overdue statement(s) on this card.
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">No overdue statements.</p>
        )}

        {unpaidStatements.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <BankReviewButton
              label="Preview interest (latest unpaid)"
              onAction={async () => {
                const target = unpaidStatements[unpaidStatements.length - 1];
                const preview = await previewAltaCardStatementInterestRecord({ data: target.id });
                setInterestPreview(
                  preview.eligible
                    ? `Statement #${target.statementNumber}: ${formatAltaCardCurrency(preview.interestAmount)} at ${preview.interestRate}% APR`
                    : preview.reason ?? "Not eligible",
                );
              }}
            />
            {admin ? (
              <>
                <BankReviewButton
                  label="Apply interest (latest unpaid)"
                  variant="primary"
                  onAction={async () => {
                    const target = unpaidStatements[unpaidStatements.length - 1];
                    await applyAltaCardStatementInterestRecord({ data: target.id });
                    setInterestPreview(null);
                    await onRefresh();
                  }}
                />
                <BankReviewButton
                  label="Run billing batch"
                  onAction={async () => {
                    await runAltaCardBillingProcessRecord();
                    await onRefresh();
                  }}
                />
                <BankReviewButton
                  label="Apply interest batch (all due)"
                  onAction={async () => {
                    await applyAltaCardInterestBatchRecord();
                    await onRefresh();
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {interestPreview ? (
          <p className="font-mono text-[12px] text-muted-foreground">{interestPreview}</p>
        ) : null}

        {fees.length > 0 ? (
          <>
            <ul className="space-y-3 md:hidden">
              {fees.map((fee) => (
                <li
                  key={fee.id}
                  className="rounded-lg border border-border bg-surface-1/80 px-3 py-3 text-[13px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium">{ALTA_CARD_FEE_TYPE_LABELS[fee.type]}</p>
                    <span className="shrink-0 font-mono tabular-nums">
                      {formatAltaCardCurrency(fee.amount)}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>{ALTA_CARD_FEE_STATUS_LABELS[fee.status]}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Date</dt>
                      <dd>{new Date(fee.createdAt).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                  {admin && fee.status === "active" ? (
                    <div className="mt-3">
                      <BankReviewButton
                        label="Waive"
                        variant="danger"
                        onAction={async () => {
                          if (!feeWaiveReason.trim()) return;
                          await waiveAltaCardFeeRecord({
                            data: { feeId: fee.id, reason: feeWaiveReason.trim() },
                          });
                          await onRefresh();
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border md:block">
            <table className="alta-table w-full min-w-[480px] text-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  {admin ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id}>
                    <td>{ALTA_CARD_FEE_TYPE_LABELS[fee.type]}</td>
                    <td className="font-mono tabular-nums">{formatAltaCardCurrency(fee.amount)}</td>
                    <td>{ALTA_CARD_FEE_STATUS_LABELS[fee.status]}</td>
                    <td className="text-muted-foreground">
                      {new Date(fee.createdAt).toLocaleDateString()}
                    </td>
                    {admin ? (
                      <td>
                        {fee.status === "active" ? (
                          <BankReviewButton
                            label="Waive"
                            variant="danger"
                            onAction={async () => {
                              if (!feeWaiveReason.trim()) return;
                              await waiveAltaCardFeeRecord({
                                data: { feeId: fee.id, reason: feeWaiveReason.trim() },
                              });
                              await onRefresh();
                            }}
                          />
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {admin ? (
              <input
                value={feeWaiveReason}
                onChange={(e) => setFeeWaiveReason(e.target.value)}
                placeholder="Reason required to waive fees"
                className="mt-3 w-full rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
              />
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">No fees on this card.</p>
        )}
      </section>
    </div>
  );
}
