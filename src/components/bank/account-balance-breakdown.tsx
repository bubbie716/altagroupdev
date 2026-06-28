import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { ACCOUNT_STATUS_COPY } from "@/lib/bank/account-status-copy";

export function AccountBalanceBreakdown({
  currentBalance,
  availableBalance,
  heldFunds,
  pendingWithdrawals = 0,
  className,
}: {
  currentBalance: number;
  availableBalance: number;
  heldFunds: number;
  pendingWithdrawals?: number;
  className?: string;
}) {
  const showBreakdown =
    heldFunds > 0 || pendingWithdrawals > 0 || availableBalance < currentBalance;

  if (!showBreakdown) return null;

  return (
    <Card className={className ?? "!p-6"}>
      <h3 className="text-[13px] font-medium tracking-wide text-foreground">Balance details</h3>
      <dl className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <dt className="type-meta">Current Balance</dt>
          <dd className="tabular text-[14px] font-medium">{florin(currentBalance)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="type-meta">Available Balance</dt>
          <dd className="tabular text-[14px] font-medium">{florin(availableBalance)}</dd>
        </div>
        {heldFunds > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="type-meta">Held Funds</dt>
            <dd className="tabular text-[14px] font-medium">{florin(heldFunds)}</dd>
          </div>
        ) : null}
      </dl>
      {heldFunds > 0 ? (
        <p className="mt-4 border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
          {ACCOUNT_STATUS_COPY.heldFundsExplanation}
        </p>
      ) : null}
    </Card>
  );
}
