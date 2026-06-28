import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsAction } from "@/components/internal/ops-action";
import { StatusBadge } from "@/components/internal/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { florin } from "@/lib/bank/api";
import { ensureInternalLoanApplicationThread } from "@/lib/bank/loan-application-thread.functions";
import { applicationListStatusLabel } from "@/lib/bank/loan-application-thread-types";
import {
  approveLoanApplicationRecord,
  denyLoanApplicationRecord,
  markLoanApplicationUnderReviewRecord,
} from "@/lib/bank/lending.functions";
import type { InternalLoanApplicationRow, LoanProductTypeCode } from "@/lib/bank/lending-types";
import { LOAN_PRODUCT_DEFAULT_MONTHLY_RATES } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { ApplicationRelationshipQueueCell } from "@/components/internal/relationship-queue-cell";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import { OPS_COPY } from "@/lib/internal/console/ops-copy";

const fieldLabel = "type-meta";
const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

function isActionable(status: InternalLoanApplicationRow["status"]) {
  return status === "pending" || status === "under_review";
}

function defaultMonthlyRate(productType: LoanProductTypeCode): string {
  const rate = LOAN_PRODUCT_DEFAULT_MONTHLY_RATES[productType];
  return rate != null ? String(rate) : "";
}

function LoanApplicationThreadLink({ row }: { row: InternalLoanApplicationRow }) {
  const router = useRouter();
  const openThread = useServerFn(ensureInternalLoanApplicationThread);
  const [pending, setPending] = useState(false);

  if (row.threadId) {
    return (
      <Link
        to="/internal/lending/applications/$applicationId"
        params={{ applicationId: row.id }}
        search={{ tab: "thread" }}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Open Secure Deal Room
      </Link>
    );
  }

  return (
    <OpsAction
      label={pending ? "Opening…" : "Open Secure Deal Room"}
      title="Open Secure Deal Room"
      description="Creates the applicant thread and opens the Secure Deal Room workspace."
      disabled={pending}
      onConfirm={async () => {
        setPending(true);
        try {
          await openThread({ data: row.id });
          await router.navigate({
            to: "/internal/lending/applications/$applicationId",
            params: { applicationId: row.id },
            search: { tab: "thread" },
          });
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

function LoanApplicationReviewActions({ row }: { row: InternalLoanApplicationRow }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState(row.reviewNote ?? "");
  const [interestRate, setInterestRate] = useState(() => defaultMonthlyRate(row.productType));
  const [principalAmount, setPrincipalAmount] = useState(String(row.requestedAmount));
  const [termMonths, setTermMonths] = useState(String(row.termMonths));
  const [expanded, setExpanded] = useState(false);

  if (!isActionable(row.status)) {
    return row.reviewNote ? (
      <span className="text-[11px] text-muted-foreground">{row.reviewNote}</span>
    ) : (
      <span className="text-[11px] text-muted-foreground">—</span>
    );
  }

  async function invalidate() {
    await router.invalidate();
  }

  return (
    <div className="min-w-[220px] space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
      >
        {expanded ? "Hide review" : "Review"}
      </button>
      {expanded && (
        <div className="space-y-2 rounded-md border border-border/60 bg-surface-2/40 p-3">
          <div>
            <label className={fieldLabel}>Review note</label>
            <Textarea
              className={`${inputClass} min-h-[56px]`}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={fieldLabel}>Monthly rate %</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder={row.productType === "private_liquidity_line" ? "Negotiated" : undefined}
              />
            </div>
            <div>
              <label className={fieldLabel}>Principal ƒ</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={fieldLabel}>Term (mo)</label>
              <input
                type="number"
                min="1"
                step="1"
                className={inputClass}
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {row.status === "pending" && (
              <OpsAction
                label="Begin review"
                title="Begin application review"
                description={OPS_COPY.lendingBeginReviewDescription}
                onConfirm={async (reason) => {
                  await markLoanApplicationUnderReviewRecord({
                    data: { applicationId: row.id, reviewNote: reviewNote.trim() || reason },
                  });
                  await invalidate();
                }}
              />
            )}
            <OpsAction
              label="Accept"
              variant="primary"
              title="Accept loan application"
              description="Creates the loan with the terms below."
              impact={`${florin(Number(principalAmount) || 0)} · ${termMonths} mo`}
              onConfirm={async (reason) => {
                await approveLoanApplicationRecord({
                  data: {
                    applicationId: row.id,
                    interestRate: Number(interestRate),
                    principalAmount: Number(principalAmount),
                    termMonths: Number(termMonths),
                    reviewNote: reviewNote.trim() || reason,
                  },
                });
                await invalidate();
              }}
            />
            <OpsAction
              label="Deny"
              variant="danger"
              title="Deny loan application"
              description="Closes the application."
              onConfirm={async (reason) => {
                await denyLoanApplicationRecord({
                  data: { applicationId: row.id, reviewNote: reviewNote.trim() || reason },
                });
                await invalidate();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function internalLendingColumns(
  summaries: {
    personal: Record<string, RelationshipProfileSummary>;
    company: Record<string, CompanyRelationshipProfileSummary>;
  } = { personal: {}, company: {} },
) {
  return [
    {
      key: "applicant",
      header: "Applicant",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="font-mono text-[11px]">{row.applicantLabel}</span>
      ),
    },
    {
      key: "relationship",
      header: "Relationship",
      cell: (row: InternalLoanApplicationRow) => (
        <ApplicationRelationshipQueueCell
          applicantUserId={row.applicantUserId}
          companyId={row.companyId}
          personalSummary={summaries.personal[row.applicantUserId]}
          companySummary={row.companyId ? summaries.company[row.companyId] : undefined}
        />
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (row: InternalLoanApplicationRow) => row.productLabel,
    },
    {
      key: "amount",
      header: "Requested",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="type-finance">{florin(row.requestedAmount)}</span>
      ),
    },
    {
      key: "term",
      header: "Term",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="type-finance">{row.termMonths} mo</span>
      ),
    },
    {
      key: "estimate",
      header: "Est. total",
      cell: (row: InternalLoanApplicationRow) =>
        row.estimatedTotalOutstanding != null ? (
          <span className="type-finance">{florin(row.estimatedTotalOutstanding)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "purpose",
      header: "Purpose",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="line-clamp-2 max-w-[200px] text-[12px] text-muted-foreground">{row.purpose}</span>
      ),
    },
    {
      key: "account",
      header: "Linked account",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="font-mono text-[11px]">{row.linkedAccountNumber ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: InternalLoanApplicationRow) => (
        <StatusBadge status={applicationListStatusLabel(row, "internal")} />
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (row: InternalLoanApplicationRow) => (
        <span className="text-[12px] text-muted-foreground">
          {formatActivityDateTime(row.submittedAt)}
        </span>
      ),
    },
    {
      key: "thread",
      header: "Deal Room",
      cell: (row: InternalLoanApplicationRow) => <LoanApplicationThreadLink row={row} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row: InternalLoanApplicationRow) => <LoanApplicationReviewActions row={row} />,
    },
  ];
}
