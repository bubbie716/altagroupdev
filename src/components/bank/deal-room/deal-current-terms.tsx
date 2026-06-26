import { Florin } from "@/components/ui/florin";
import { DealStatusBadge } from "@/components/bank/deal-room/deal-room-bits";
import { formatInterestRateLabel } from "@/lib/bank/loan-interest";
import type { DealRoomTermsContext } from "@/lib/bank/deal-room-types";
import type { DealRoomStatus } from "@/lib/bank/deal-rooms-mock";

export function DealCurrentTerms({
  status,
  terms,
}: {
  status: DealRoomStatus;
  terms: DealRoomTermsContext;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Current Terms
        </h2>
        <DealStatusBadge status={status} />
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TermCell label="Requested amount">
          <Florin value={terms.requestedAmount} fractionDigits={0} />
        </TermCell>
        <TermCell label="Current proposed amount">
          {terms.currentProposedAmount != null ? (
            <Florin value={terms.currentProposedAmount} fractionDigits={0} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TermCell>
        <TermCell label="Current proposed rate">
          {terms.currentProposedRate != null ? (
            <span className="tabular font-mono">
              {formatInterestRateLabel(terms.currentProposedRate)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TermCell>
        <TermCell label="Current proposed term">
          {terms.currentProposedTermMonths != null ? (
            <span className="tabular font-mono">{terms.currentProposedTermMonths} mo</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TermCell>
      </dl>

      {terms.acceptedTerms && (
        <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Accepted terms
          </div>
          <dl className="mt-2 grid gap-2 sm:grid-cols-3 text-[13px]">
            <div>
              <span className="text-muted-foreground">Principal </span>
              <Florin value={terms.acceptedTerms.principal} fractionDigits={0} />
            </div>
            <div>
              <span className="text-muted-foreground">Rate </span>
              <span className="tabular font-mono">
                {formatInterestRateLabel(terms.acceptedTerms.interestRate)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Term </span>
              <span className="tabular font-mono">{terms.acceptedTerms.termMonths} mo</span>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

function TermCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium tabular">{children}</dd>
    </div>
  );
}
