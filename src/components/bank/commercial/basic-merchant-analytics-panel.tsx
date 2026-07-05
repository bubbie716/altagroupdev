import type { BasicMerchantAnalytics, MerchantAnalyticsRecentPayment } from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";

function paymentSourceLabel(source: MerchantAnalyticsRecentPayment["source"]): string {
  switch (source) {
    case "invoice":
      return "Invoice";
    case "payment_link":
      return "Payment link";
    case "alta_pay":
      return "Alta Pay";
  }
}

export function BasicMerchantAnalyticsPanel({
  analytics,
  accountId,
}: {
  analytics: BasicMerchantAnalytics;
  accountId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!p-5">
          <p className="text-xs text-muted-foreground">Revenue this month</p>
          <p className="mt-2 text-2xl font-medium">{florin(analytics.revenueThisMonth)}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          <p className="mt-2 text-2xl font-medium">
            {florin(analytics.outstandingInvoiceTotal)}
          </p>
        </Card>
      </div>

      <Card className="!p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Recent payments
        </p>
        {analytics.recentPayments.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">No payments recorded this month.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {analytics.recentPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{payment.customerLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {payment.referenceCode} · {paymentSourceLabel(payment.source)}
                  </p>
                </div>
                <div className="text-right">
                  <p>{florin(payment.grossAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatActivityDateTime(payment.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="!p-5">
        <p className="text-[13px] text-muted-foreground">
          Upgrade to Alta Commercial Pro for trends, top customers, success rates, longer history,
          and exports.
        </p>
        <a
          href={`/bank/account/${accountId}/commercial/settings`}
          className="mt-4 inline-flex rounded-md border border-foreground px-4 py-2 text-sm font-medium"
        >
          Upgrade to Pro
        </a>
      </Card>
    </div>
  );
}
