import { useEffect, useState } from "react";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import type { BankRequestInProgress } from "@/lib/bank/backend-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { BANK_REQUESTS_IN_PROGRESS_ID } from "@/components/bank/bank-request-submission-ui";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
  bankTableShellClass,
} from "@/components/bank/bank-scroll-contain";
import { BankAccountActivityLink } from "@/components/bank/bank-account-activity-link";

const DEFAULT_VISIBLE = 5;

function RequestStatusCell({ request }: { request: BankRequestInProgress }) {
  return (
    <div className="space-y-1.5">
      <StatusBadge status={request.statusLabel} />
      {request.status === "denied" && request.denialMessage ? (
        <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">{request.denialMessage}</p>
      ) : null}
    </div>
  );
}

function RequestProofCell({ request }: { request: BankRequestInProgress }) {
  if (!request.hasProof || !request.proofImageUrl) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  return (
    <button
      type="button"
      onClick={() => window.open(request.proofImageUrl!, "_blank", "noopener,noreferrer")}
      className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
    >
      View
    </button>
  );
}

function RequestRow({
  request,
  highlighted,
  showProof,
  className,
}: {
  request: BankRequestInProgress;
  highlighted?: boolean;
  showProof?: boolean;
  className?: string;
}) {
  return (
    <tr
      id={`bank-request-row-${request.referenceCode}`}
      className={cn(
        "border-b border-border/50 last:border-0 transition-colors duration-500 hover:bg-surface-2/40",
        highlighted && "bg-gold/8 ring-1 ring-inset ring-gold/35",
        className,
      )}
    >
      <td>
        <RequestStatusCell request={request} />
      </td>
      <td>
        <BankAccountActivityLink
          accountId={request.bankAccountId}
          accountName={request.accountName}
          accountNumber={request.accountNumber}
        />
      </td>
      <td className="type-finance-md font-medium tabular">{florin(request.amount)}</td>
      <td className="type-finance-sm text-muted-foreground">
        {formatActivityDateTime(request.submittedAt)}
      </td>
      <td className="type-finance-sm text-muted-foreground">
        {formatActivityDateTime(request.lastUpdatedAt)}
      </td>
      <td className="type-finance-sm text-muted-foreground">{request.referenceCode}</td>
      {showProof ? (
        <td>
          <RequestProofCell request={request} />
        </td>
      ) : null}
    </tr>
  );
}

export function BankRequestsInProgress({
  requests,
  highlightReferenceCode,
  showProof = false,
}: {
  requests: BankRequestInProgress[];
  highlightReferenceCode?: string | null;
  showProof?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = requests.length > DEFAULT_VISIBLE;

  const highlightIndex = highlightReferenceCode
    ? requests.findIndex((request) => request.referenceCode === highlightReferenceCode)
    : -1;

  useEffect(() => {
    if (highlightIndex >= DEFAULT_VISIBLE) {
      setExpanded(true);
    }
  }, [highlightIndex]);

  const visibleRequests = expanded ? requests : requests.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = requests.length - DEFAULT_VISIBLE;

  return (
    <div id={BANK_REQUESTS_IN_PROGRESS_ID} className="mx-auto mt-8 max-w-2xl scroll-mt-8">
      <Card className={cn(bankTableShellClass, "!p-0")}>
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-medium tracking-tight">Requests in Progress</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Active and recently declined requests awaiting resolution.
          </p>
        </div>

        {requests.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted-foreground sm:px-6">
            No requests currently in progress.
          </p>
        ) : (
          <>
            <BankMobileStack>
              {visibleRequests.map((request) => {
                const highlighted = highlightReferenceCode === request.referenceCode;
                return (
                <BankMobileStackRow
                  key={request.id}
                  id={`bank-request-row-${request.referenceCode}`}
                  className={cn(
                    "transition-colors duration-500",
                    highlighted && "bg-gold/8 ring-1 ring-inset ring-gold/35",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <RequestStatusCell request={request} />
                    <span className="type-finance-md shrink-0 font-medium tabular">
                      {florin(request.amount)}
                    </span>
                  </div>
                  <BankMobileStackField label="Account">
                    <BankAccountActivityLink
                      accountId={request.bankAccountId}
                      accountName={request.accountName}
                      accountNumber={request.accountNumber}
                    />
                  </BankMobileStackField>
                  <BankMobileStackField label="Submitted">
                    {formatActivityDateTime(request.submittedAt)}
                  </BankMobileStackField>
                  <BankMobileStackField label="Last updated">
                    {formatActivityDateTime(request.lastUpdatedAt)}
                  </BankMobileStackField>
                  <BankMobileStackField label="Reference">{request.referenceCode}</BankMobileStackField>
                  {showProof ? (
                    <BankMobileStackField label="Proof">
                      <RequestProofCell request={request} />
                    </BankMobileStackField>
                  ) : null}
                </BankMobileStackRow>
                );
              })}
            </BankMobileStack>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out md:contents",
                expanded && hasMore ? "grid-rows-[1fr]" : "grid-rows-[1fr]",
              )}
            >
              <BankTableScroll>
                <table className="alta-table w-full min-w-[920px] text-sm">
                  <thead className="sticky top-0 z-[1] bg-surface-1 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
                    <tr>
                      <th>Status</th>
                      <th>Account</th>
                      <th>Amount</th>
                      <th>Submitted</th>
                      <th>Last updated</th>
                      <th>Reference</th>
                      {showProof ? <th>Proof</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRequests.map((request) => (
                      <RequestRow
                        key={request.id}
                        request={request}
                        showProof={showProof}
                        highlighted={highlightReferenceCode === request.referenceCode}
                      />
                    ))}
                  </tbody>
                </table>
              </BankTableScroll>
            </div>

            {hasMore ? (
              <div className="border-t border-border px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="w-full rounded-md border border-border bg-surface-2/40 px-4 py-2.5 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2 sm:w-auto"
                >
                  {expanded ? "Show fewer requests" : `Show all requests (${hiddenCount} more)`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
