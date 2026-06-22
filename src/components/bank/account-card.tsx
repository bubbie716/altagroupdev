import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { BankAccount } from "@/lib/bank/api";

export function AccountCard({ account }: { account: BankAccount }) {
  return (
    <Card className="group cursor-default">
      <div className="flex items-start justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {account.product}
        </div>
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.18em] ${
            account.status === "Active" ? "text-[var(--success)]" : "text-muted-foreground"
          }`}
        >
          {account.status}
        </span>
      </div>
      <div className="mt-5 text-base font-medium tracking-tight">{account.name}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{account.accountNumber}</div>
      <div className="tabular mt-4 text-2xl font-semibold tracking-tight">{florin(account.balance)}</div>
      <div className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        {account.recentActivity}
      </div>
    </Card>
  );
}
