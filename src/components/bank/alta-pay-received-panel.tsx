import { Card } from "@/components/page-shell";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AltaPayPaymentRow, AltaPayReceivedSummary } from "@/lib/bank/alta-pay-types";

export function AltaPayReceivedPanel({ summary }: { summary: AltaPayReceivedSummary }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <BankStatCard
          label="Alta Pay received this month"
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

      <Card className="!p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Recent customer payments
        </div>
        {summary.recentPayments.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            No Alta Pay payments received yet. Customers can pay you at{" "}
            <span className="font-mono text-foreground">/bank/pay</span> once your company is verified
            with an active Business Operating Account.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
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
          </div>
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
    <div className="overflow-x-auto">
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
              <td className="text-muted-foreground">{p.sourceAccountName ?? "—"}</td>
              <td className="type-finance-nums">{florin(p.amount)}</td>
              <td className="font-mono text-[11px]">{p.referenceCode}</td>
              <td className="text-muted-foreground">{p.memo ?? "—"}</td>
              <td className="text-muted-foreground">{formatActivityDateTime(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
