import { florin } from "@/lib/bank/api";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/internal/status-badge";
import { cn } from "@/lib/utils";

export function LoanRepaymentProgressBar({
  principalAmount,
  principalRepaid,
  principalPercentRepaid,
  currentPayoffAmount,
  guaranteedInterestOwed = 0,
  statusLabel,
  compact,
}: {
  principalAmount: number;
  principalRepaid: number;
  principalPercentRepaid: number;
  currentPayoffAmount: number;
  guaranteedInterestOwed?: number;
  statusLabel: string;
  compact?: boolean;
}) {
  const percentDisplay = principalPercentRepaid.toFixed(
    principalPercentRepaid % 1 === 0 ? 0 : 1,
  );

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-muted-foreground", compact ? "text-[12px]" : "text-[13px]")}>
          <span className="type-finance text-foreground">
            Principal repaid {florin(principalRepaid)} of {florin(principalAmount)}
          </span>
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
          {percentDisplay}% repaid
        </span>
      </div>

      <Progress
        value={principalPercentRepaid}
        className="h-1.5 rounded-full bg-foreground/[0.06] ring-1 ring-inset ring-border [&>div]:bg-gold [&>div]:transition-all [&>div]:duration-700"
      />

      {guaranteedInterestOwed > 0 && (
        <p className={cn("text-muted-foreground", compact ? "text-[12px]" : "text-[13px]")}>
          Guaranteed interest owed:{" "}
          <span className="type-finance font-medium text-foreground">
            {florin(guaranteedInterestOwed)}
          </span>
        </p>
      )}

      <div
        className={cn(
          "rounded-lg border border-gold/25 bg-gold/5 px-4 py-3",
          compact && "px-3 py-2.5",
        )}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Current payoff amount
        </div>
        <div
          className={cn(
            "type-finance mt-1 font-semibold text-gold",
            compact ? "text-lg" : "text-xl",
          )}
        >
          {florin(currentPayoffAmount)}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Includes outstanding principal plus guaranteed unpaid interest.
        </p>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <StatusBadge status={statusLabel} />
        </div>
      )}
    </div>
  );
}
