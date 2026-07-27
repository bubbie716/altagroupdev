import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { ACCOUNT_STATUS_COPY } from "@/lib/bank/account-status-copy";

/**
 * Shows only the causes of a current vs available difference.
 * Does not repeat Current/Available balances already shown in the hero.
 */
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
      <h3 className="text-[13px] font-medium tracking-wide text-foreground">Why balances differ</h3>
      <dl className="mt-4 space-y-3">
        {heldFunds > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="type-meta">Held funds</dt>
            <dd className="tabular text-[14px] font-medium">{florin(heldFunds)}</dd>
          </div>
        ) : null}
        {pendingWithdrawals > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="type-meta">Pending withdrawals</dt>
            <dd className="tabular text-[14px] font-medium">{florin(pendingWithdrawals)}</dd>
          </div>
        ) : null}
        {heldFunds <= 0 && pendingWithdrawals <= 0 && availableBalance < currentBalance ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="type-meta">Unavailable</dt>
            <dd className="tabular text-[14px] font-medium">
              {florin(currentBalance - availableBalance)}
            </dd>
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
