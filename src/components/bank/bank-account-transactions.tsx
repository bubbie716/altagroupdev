import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { UserBankTransaction } from "@/lib/bank/backend-types";

export function BankAccountTransactions({
  transactions,
}: {
  transactions: UserBankTransaction[];
}) {
  if (transactions.length === 0) {
    return (
      <Card className="!p-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          No activity
        </p>
        <h3 className="mt-3 text-lg font-semibold tracking-tight">No transactions yet</h3>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Deposits, withdrawals, and adjustments will appear here once account activity begins.
        </p>
      </Card>
    );
  }

  return (
    <Card className="!p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3">Date & time</th>
            <th className="px-5 py-3">Reference</th>
            <th className="px-5 py-3">Description</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3">Proof</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const signedAmount =
              tx.type === "withdrawal" ? -Math.abs(tx.amount) : Math.abs(tx.amount);

            return (
              <tr
                key={tx.id}
                className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
              >
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                  {formatActivityDateTime(tx.createdAt)}
                </td>
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                  {tx.referenceCode}
                </td>
                <td className="px-5 py-3">{tx.description}</td>
                <td className="px-5 py-3 text-muted-foreground">{tx.typeLabel}</td>
                <td className="px-5 py-3 font-mono text-[11px]">{tx.statusLabel}</td>
                <td
                  className={`tabular px-5 py-3 text-right font-medium ${
                    signedAmount >= 0 ? "ticker-up" : "ticker-down"
                  }`}
                >
                  {signedAmount >= 0 ? "+" : ""}
                  {florin(signedAmount)}
                </td>
                <td className="px-5 py-3 text-[12px]">
                  {tx.hasProof && tx.proofImageUrl ? (
                    <a
                      href={tx.proofImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      <Link
        to={to}
        search={search}
        className="mt-5 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface-2/40 px-4 py-2.5 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2"
      >
        {label}
      </Link>
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
