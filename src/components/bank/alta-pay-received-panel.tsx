import { Card } from "@/components/page-shell";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AltaPayPaymentRow, AltaPayReceivedSummary } from "@/lib/bank/alta-pay-types";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";

function AltaPayPaymentMobileList({ payments }: { payments: AltaPayPaymentRow[] }) {
  return (
    <BankMobileStack>
      {payments.map((p) => (
        <BankMobileStackRow key={p.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium break-words">{p.payerLabel ?? p.payeeLabel}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {formatActivityDateTime(p.createdAt)}
              </p>
            </div>
            <span className="type-finance-nums shrink-0">{florin(p.amount)}</span>
          </div>
          <BankMobileStackField label="Reference">{p.referenceCode}</BankMobileStackField>
          <BankMobileStackField label="Memo">{p.memo ?? "—"}</BankMobileStackField>
          {p.fundingSourceLabel || p.sourceAccountName ? (
            <BankMobileStackField label="From account">
              {p.fundingSourceLabel || p.sourceAccountName}
            </BankMobileStackField>
          ) : null}
        </BankMobileStackRow>
      ))}
    </BankMobileStack>
  );
}

export function AltaPayReceivedPanel({ summary }: { summary: AltaPayReceivedSummary }) {
  return (
    <div className="min-w-0 space-y-8">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <BankStatCard
          label="Payments received this month"
          value={florin(summary.totalThisMonth)}
          sub={`${summary.paymentCountThisMonth} payment${summary.paymentCountThisMonth === 1 ? "" : "s"}`}
          accent
        />
        <BankStatCard
          label="Settlement"
          value="Instant"
          sub="Business Operating Account · Intrabank"
        />
      </div>

      <Card className="min-w-0 !p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Recent customer payments
          </div>
        </div>
        {summary.recentPayments.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted-foreground sm:px-6">
            No customer payments received yet. Payments from Alta Pay, invoices, and payment links
            will appear here once customers pay your verified Business Operating Account.
          </p>
        ) : (
          <>
            <AltaPayPaymentMobileList payments={summary.recentPayments} />
            <BankTableScroll className="px-0">
              <table className="alta-table w-full min-w-[520px] text-sm">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Memo</th>
                    <th>Date & time</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payerLabel}</td>
                      <td className="type-finance-nums">{florin(p.amount)}</td>
                      <td className="font-mono text-[11px]">{p.referenceCode}</td>
                      <td className="text-muted-foreground">{p.memo ?? "—"}</td>
                      <td className="text-muted-foreground">{formatActivityDateTime(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BankTableScroll>
          </>
        )}
      </Card>
    </div>
  );
}

export function AltaPayHistoryTable({ payments }: { payments: AltaPayPaymentRow[] }) {
  if (payments.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No Alta Pay payments sent yet.</p>;
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <AltaPayPaymentMobileList payments={payments} />
      <BankTableScroll>
        <table className="alta-table w-full min-w-[520px] text-sm">
          <thead>
            <tr>
              <th>Business</th>
              <th>From account</th>
              <th>Amount</th>
              <th>Reference</th>
              <th>Memo</th>
              <th>Date & time</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.payeeLabel}</td>
                <td className="text-muted-foreground">
                  {p.fundingSourceLabel || p.sourceAccountName || "—"}
                </td>
                <td className="type-finance-nums">{florin(p.amount)}</td>
                <td className="font-mono text-[11px]">{p.referenceCode}</td>
                <td className="text-muted-foreground">{p.memo ?? "—"}</td>
                <td className="text-muted-foreground">{formatActivityDateTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BankTableScroll>
    </div>
  );
}
