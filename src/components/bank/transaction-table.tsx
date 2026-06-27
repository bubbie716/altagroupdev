import { Card } from "@/components/page-shell";
import { florin } from "@/lib/mock-data";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { BankAccountActivityLink } from "@/components/bank/bank-account-activity-link";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
  bankTableShellClass,
} from "@/components/bank/bank-scroll-contain";

type Row = {
  id: string;
  date: string;
  desc: string;
  category: string;
  amount: number;
  accountId?: string;
  accountName?: string;
  accountNumber?: string;
};

export function TransactionTable({
  rows,
  title = "Recent Activity",
  showAccount = false,
}: {
  rows: Row[];
  title?: string;
  showAccount?: boolean;
}) {
  return (
    <Card className={`${bankTableShellClass} !p-0`}>
      {title && (
        <div className="border-b border-border px-5 py-3 type-meta">
          {title}
        </div>
      )}

      <BankMobileStack>
        {rows.map((t) => (
          <BankMobileStackRow key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words">{t.desc}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {formatActivityDateTime(t.date)}
                </p>
              </div>
              <span
                className={`tabular shrink-0 font-medium ${t.amount >= 0 ? "ticker-up" : "ticker-down"}`}
              >
                {t.amount >= 0 ? "+" : ""}
                {florin(t.amount)}
              </span>
            </div>
            <BankMobileStackField label="Reference">{t.id}</BankMobileStackField>
            <BankMobileStackField label="Category">{t.category}</BankMobileStackField>
            {showAccount && t.accountId && t.accountName && t.accountNumber ? (
              <BankMobileStackField label="Account">
                <BankAccountActivityLink
                  accountId={t.accountId}
                  accountName={t.accountName}
                  accountNumber={t.accountNumber}
                />
              </BankMobileStackField>
            ) : null}
          </BankMobileStackRow>
        ))}
      </BankMobileStack>

      <BankTableScroll>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left type-meta">
              <th className="px-5 py-3">Date & time</th>
              {showAccount ? <th className="px-5 py-3">Account</th> : null}
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
              >
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                  {formatActivityDateTime(t.date)}
                </td>
                {showAccount ? (
                  <td className="px-5 py-3">
                    {t.accountId && t.accountName && t.accountNumber ? (
                      <BankAccountActivityLink
                        accountId={t.accountId}
                        accountName={t.accountName}
                        accountNumber={t.accountNumber}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{t.id}</td>
                <td className="px-5 py-3">{t.desc}</td>
                <td className="px-5 py-3 text-muted-foreground">{t.category}</td>
                <td
                  className={`tabular px-5 py-3 text-right font-medium ${t.amount >= 0 ? "ticker-up" : "ticker-down"}`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {florin(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BankTableScroll>
    </Card>
  );
}
