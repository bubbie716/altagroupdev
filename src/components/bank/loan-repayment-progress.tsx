import { florin } from "@/lib/bank/api";
import type { LoanRepaymentProgress } from "@/lib/bank/lending-progress";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/internal/status-badge";
import { cn } from "@/lib/utils";

export function LoanRepaymentProgressBar({
  projectedOutstanding,
  amountRepaid,
  percentRepaid,
  totalRepaymentObligation,
  statusLabel,
  compact,
}: Pick<
  LoanRepaymentProgress,
  "amountRepaid" | "percentRepaid" | "totalRepaymentObligation"
> & {
  projectedOutstanding: number;
  statusLabel: string;
  compact?: boolean;
}) {
  const percentDisplay = percentRepaid.toFixed(percentRepaid % 1 === 0 ? 0 : 1);
  const repaymentTarget = totalRepaymentObligation;

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-muted-foreground", compact ? "text-[12px]" : "text-[13px]")}>
          <span className="type-finance text-foreground">
            {florin(amountRepaid)} of {florin(repaymentTarget)} repaid
          </span>
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
          {percentDisplay}% repaid
        </span>
      </div>

      <Progress
        value={percentRepaid}
        className="h-1.5 rounded-full bg-foreground/[0.06] ring-1 ring-inset ring-border [&>div]:bg-gold [&>div]:transition-all [&>div]:duration-700"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
        <span>
          Projected outstanding:{" "}
          <span className="type-finance text-foreground">{florin(projectedOutstanding)}</span>
        </span>
        {!compact && <StatusBadge status={statusLabel} />}
      </div>
    </div>
  );
}
