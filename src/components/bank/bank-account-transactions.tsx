import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
import type { UserBankTransaction } from "@/lib/bank/backend-types";
import { RouteButton } from "@/components/bank/route-button";
import { EmptyState } from "@/components/data/empty-state";

export function BankAccountTransactions({
  transactions,
}: {
  transactions: UserBankTransaction[];
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        eyebrow="Alta Bank · Activity"
        title="No transactions yet"
        description="Deposits, withdrawals, loan payments, and adjustments will appear here once account activity begins."
        compact
      />
    );
  }

  return (
    <Card className="!p-0 overflow-x-auto">
      <div className="w-full overflow-x-auto"><table className="alta-table w-full min-w-[820px] text-sm">
        <thead>
          <tr>
            <th>Date & time</th>
            <th>Reference</th>
            <th>Description</th>
            <th>Type</th>
            <th>Status</th>
            <th className="text-right">Amount</th>
            <th>Proof</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const signedAmount = getSignedBankTransactionAmount(tx.type, tx.amount);

            return (
              <tr
                key={tx.id}
                className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
              >
                <td className="type-finance-sm text-muted-foreground">
                  {formatActivityDateTime(tx.createdAt)}
                </td>
                <td className="type-finance-sm text-muted-foreground">
                  {tx.referenceCode}
                </td>
                <td>{tx.description}</td>
                <td className="text-muted-foreground">{tx.typeLabel}</td>
                <td className="type-finance-sm">{tx.statusLabel}</td>
                <td
                  className={`type-finance-md text-right font-medium ${
                    signedAmount >= 0 ? "ticker-up" : "ticker-down"
                  }`}
                >
                  {signedAmount >= 0 ? "+" : ""}
                  {florin(signedAmount)}
                </td>
                <td className="px-5 py-3 text-[12px]">
                  {tx.hasProof && tx.proofImageUrl ? (
                    <button
                      type="button"
                      onClick={() => window.open(tx.proofImageUrl!, "_blank", "noopener,noreferrer")}
                      className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </Card>
  );
}

export function BankAccountActionCard({
  title,
  description,
  to,
  label,
  search,
}: {
  title: string;
  description: string;
  to: string;
  label: string;
  search?: Record<string, string>;
}) {
  return (
    <Card className="flex flex-col !p-6">
      <h3 className="font-medium tracking-tight">{title}</h3>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <RouteButton
        to={to}
        search={search}
        className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface-2/40 px-4 py-2.5 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2"
      >
        {label}
      </RouteButton>
    </Card>
  );
}

export function BankAccountPlaceholderCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="!p-6">
      <h3 className="font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
    </Card>
  );
}
