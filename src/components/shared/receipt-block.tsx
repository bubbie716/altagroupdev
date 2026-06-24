import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Florin } from "@/components/ui/florin";
import { StatusBadge } from "@/components/internal/status-badge";

/**
 * Branded confirmation receipt — printable, reference-numbered.
 *
 * Used after deposits, withdrawals, transfers, loan payments and
 * (future) payroll runs. Visual idiom: a stamped bank slip — hairline
 * borders, mono ID grid, large tabular amount.
 */
export type ReceiptKind =
  | "Deposit"
  | "Withdrawal"
  | "Transfer"
  | "Loan payment"
  | "Payroll";

export type ReceiptRow = { label: string; value: ReactNode };

export function ReceiptBlock({
  kind,
  status = "Posted",
  reference,
  timestamp,
  amount,
  account,
  counterparty,
  rows,
  memo,
  className,
  actions,
}: {
  kind: ReceiptKind;
  status?: string;
  reference: string;
  timestamp: string; // ISO or pre-formatted
  amount: number;
  account: string;
  counterparty?: string;
  rows?: ReceiptRow[];
  memo?: string;
  className?: string;
  actions?: ReactNode;
}) {
  const ts =
    timestamp.includes("T") || timestamp.includes("-")
      ? new Date(timestamp).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " ET"
      : timestamp;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-surface-1 print:border-black",
        className,
      )}
    >
      {/* Top accent rule */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-gold/50 to-transparent" />

      {/* Header */}
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-start sm:px-8 sm:py-6">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Alta Bank · Confirmation
          </div>
          <h3 className="mt-2 font-serif text-2xl leading-tight tracking-tight">{kind}</h3>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <StatusBadge status={status} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Ref · <span className="text-foreground">{reference}</span>
          </span>
        </div>
      </div>

      <div className="border-t border-border/70" />

      {/* Amount block */}
      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Amount
        </div>
        <Florin
          value={amount}
          className="mt-3 block text-4xl leading-none tracking-tight sm:text-5xl"
        />
      </div>

      <div className="border-t border-border/70" />

      {/* Detail grid */}
      <dl className="grid grid-cols-1 gap-px bg-border/70 sm:grid-cols-2">
        <Cell label="Account" value={account} />
        {counterparty ? <Cell label="Counterparty" value={counterparty} /> : null}
        <Cell label="Timestamp" value={ts} mono />
        <Cell label="Reference" value={reference} mono />
        {rows?.map((r) => <Cell key={r.label} label={r.label} value={r.value} />)}
      </dl>

      {memo ? (
        <>
          <div className="border-t border-border/70" />
          <div className="px-6 py-5 sm:px-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Memo
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{memo}</p>
          </div>
        </>
      ) : null}

      {/* Footer */}
      <div className="border-t border-border/70 bg-surface-2/50 px-6 py-4 sm:px-8 print:bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            This confirmation is your record of the transaction.
          </span>
          {actions ? (
            <div className="flex items-center gap-2 print:hidden">{actions}</div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface-1 px-6 py-4 sm:px-8 sm:py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[14px] text-foreground",
          mono && "font-mono text-[13px] tracking-tight",
        )}
      >
        {value}
      </div>
    </div>
  );
}