import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  presentUserBankTransaction,
  type BankTransactionPresentation,
} from "@/lib/bank/transaction-display";
import type { UserBankTransaction } from "@/lib/bank/backend-types";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";
import { EmptyState } from "@/components/data/empty-state";
import { BankAccountActivityLink } from "@/components/bank/bank-account-activity-link";
import {
  BankActivityScroll,
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
  bankTableShellClass,
} from "@/components/bank/bank-scroll-contain";

/** Pending and denied rows get emphasis so a toned-down amount is not read as settled. */
function statusToneClass(view: BankTransactionPresentation): string | undefined {
  if (!view.showStatus) return undefined;
  return view.tone === "denied" ? "text-destructive" : "text-muted-foreground";
}

export function BankAccountTransactions({
  transactions,
  showAccount = false,
  scrollable,
}: {
  transactions: UserBankTransaction[];
  /** Show account column for multi-account views (e.g. bank dashboard). */
  showAccount?: boolean;
  /** Constrain list height with vertical scroll instead of extending the page. */
  scrollable?: "full" | "compact";
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

  const list = (
    <>
      <BankMobileStack>
        {transactions.map((tx) => {
          const view = presentUserBankTransaction(tx);
          return (
            <BankMobileStackRow key={tx.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">{tx.description}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatActivityDateTime(tx.createdAt)}
                  </p>
                </div>
                <span
                  className={cn("type-finance-md shrink-0 font-medium", view.amountClassName)}
                  aria-label={view.accessibleAmount}
                >
                  {view.displayAmount}
                </span>
              </div>
              <BankMobileStackField label="Reference">{tx.referenceCode}</BankMobileStackField>
              <BankMobileStackField label="Type">{view.typeLabel}</BankMobileStackField>
              <BankMobileStackField label="Status">
                <span className={statusToneClass(view)}>{view.statusLabel ?? tx.statusLabel}</span>
              </BankMobileStackField>
              {showAccount ? (
                <BankMobileStackField label="Account">
                  <BankAccountActivityLink
                    accountId={tx.bankAccountId}
                    accountName={tx.accountName}
                    accountNumber={tx.accountNumber}
                  />
                </BankMobileStackField>
              ) : null}
              {tx.hasProof && tx.proofImageUrl ? (
                <BankMobileStackField label="Proof">
                  <button
                    type="button"
                    onClick={() => window.open(tx.proofImageUrl!, "_blank", "noopener,noreferrer")}
                    className="rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
                  >
                    View
                  </button>
                </BankMobileStackField>
              ) : null}
            </BankMobileStackRow>
          );
        })}
      </BankMobileStack>

      <BankTableScroll>
        <table className="alta-table w-full min-w-[820px] text-sm">
          <thead className="sticky top-0 z-[1] bg-surface-1 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
            <tr>
              <th>Date & time</th>
              {showAccount ? <th>Account</th> : null}
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
              const view = presentUserBankTransaction(tx);

              return (
                <tr
                  key={tx.id}
                  className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
                >
                  <td className="type-finance-sm text-muted-foreground">
                    {formatActivityDateTime(tx.createdAt)}
                  </td>
                  {showAccount ? (
                    <td>
                      <BankAccountActivityLink
                        accountId={tx.bankAccountId}
                        accountName={tx.accountName}
                        accountNumber={tx.accountNumber}
                      />
                    </td>
                  ) : null}
                  <td className="type-finance-sm text-muted-foreground">
                    {tx.referenceCode}
                  </td>
                  <td>{tx.description}</td>
                  <td className="text-muted-foreground">{view.typeLabel}</td>
                  <td className={cn("type-finance-sm", statusToneClass(view))}>
                    {view.statusLabel ?? tx.statusLabel}
                  </td>
                  <td
                    className={cn("type-finance-md text-right font-medium", view.amountClassName)}
                    aria-label={view.accessibleAmount}
                  >
                    {view.displayAmount}
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
        </table>
      </BankTableScroll>
    </>
  );

  return (
    <Card className={`${bankTableShellClass} !p-0`}>
      {scrollable ? <BankActivityScroll size={scrollable}>{list}</BankActivityScroll> : list}
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
    <Card className="flex min-w-0 flex-col !p-6">
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
    <Card className="min-w-0 !p-6">
      <h3 className="font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
    </Card>
  );
}
