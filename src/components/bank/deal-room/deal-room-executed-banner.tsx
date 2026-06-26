import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Florin } from "@/components/ui/florin";
import type { DealRoomExecutionSummary } from "@/lib/lending/loan-execution-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function DealRoomExecutedBanner({
  execution,
  variant,
}: {
  execution: DealRoomExecutionSummary;
  variant: "user" | "internal";
}) {
  if (!execution.isExecuted) return null;

  const nextDueLabel = execution.nextDueDate
    ? formatActivityDateTime(new Date(execution.nextDueDate))
    : "—";

  return (
    <section className="border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
          {variant === "user" ? "Congratulations" : "Execution complete"}
        </p>
        <h2 className="mt-1 font-serif text-[20px] tracking-tight text-foreground">
          {variant === "user"
            ? "Your loan has been funded."
            : "This deal room has been successfully executed."}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {variant === "user"
            ? "The executed agreement is now a live Alta Bank loan. Conversation, offers, and negotiation are closed."
            : "Loan created automatically from the executed agreement. No further negotiation is permitted."}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Principal" value={<Florin value={execution.principal} />} />
          <Stat label="Rate" value={`${execution.interestRate.toFixed(2)}% / month`} />
          <Stat label="Term" value={`${execution.termMonths} months`} />
          <Stat
            label={variant === "user" ? "Monthly payment" : "Next due"}
            value={
              variant === "user" ? (
                <Florin value={execution.monthlyPayment} />
              ) : (
                nextDueLabel
              )
            }
          />
        </div>

        {variant === "user" && execution.fundingAccountLabel ? (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Destination account: {execution.fundingAccountLabel}
          </p>
        ) : null}

        {variant === "internal" ? (
          <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Loan ID</dt>
              <dd className="mt-0.5 font-mono">{execution.loanId}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Agreement ID</dt>
              <dd className="mt-0.5 font-mono">{execution.agreementId}</dd>
            </div>
            {execution.disbursementReference ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Disbursement ref
                </dt>
                <dd className="mt-0.5 font-mono">{execution.disbursementReference}</dd>
              </div>
            ) : null}
            {execution.fundingAccountLabel ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Funding account
                </dt>
                <dd className="mt-0.5">{execution.fundingAccountLabel}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {variant === "user" ? (
            <Link
              to={execution.userLoanUrl}
              className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
            >
              View loan
            </Link>
          ) : execution.internalLoanUrl ? (
            <Link
              to={execution.internalLoanUrl}
              className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
            >
              Open loan
            </Link>
          ) : null}
          {execution.agreementDownloadUrl ? (
            <a
              href={execution.agreementDownloadUrl}
              className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground"
            >
              Download agreement
            </a>
          ) : null}
          {variant === "internal" && execution.internalLoanUrl ? (
            <Link
              to={execution.internalLoanUrl}
              className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground"
            >
              View ledger & schedule
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[14px] font-medium tabular-nums">{value}</div>
    </div>
  );
}
