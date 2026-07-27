import { Link } from "@tanstack/react-router";
import type { BasicMerchantAnalytics, MerchantAnalyticsRecentPayment } from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
} from "@/components/bank/bank-scroll-contain";

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
  const hasActivity =
    analytics.revenueThisMonth > 0 ||
    analytics.outstandingInvoiceTotal > 0 ||
    analytics.recentPayments.length > 0;

  return (
    <div className="space-y-6 pb-[calc(var(--bank-mobile-nav-offset)+0.5rem)] md:pb-0">
      <Card className="!p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Core summary
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          A simple month-to-date snapshot of collections. Channel trends, success rates, and exports
          are part of Alta Commercial Pro.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="!p-5">
          <p className="text-xs text-muted-foreground">Revenue this month</p>
          <p className="mt-2 text-2xl font-medium tabular-nums">
            {florin(analytics.revenueThisMonth)}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Combined invoice, payment link, and Alta Pay receipts
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-xs text-muted-foreground">Outstanding invoices</p>
          <p className="mt-2 text-2xl font-medium tabular-nums">
            {florin(analytics.outstandingInvoiceTotal)}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">Open invoice receivables only</p>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Recent payments
          </p>
        </div>
        {!hasActivity && analytics.recentPayments.length === 0 ? (
          <div className="px-5 py-8 sm:px-6">
            <p className="text-[14px] font-medium">No collections activity yet</p>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              When customers pay invoices, payment links, or Alta Pay requests, they will appear
              here. This empty summary is expected on Core until you start collecting.
            </p>
          </div>
        ) : analytics.recentPayments.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground sm:px-6">
            No payments recorded this month.
          </p>
        ) : (
          <>
            <BankMobileStack>
              {analytics.recentPayments.map((payment) => (
                <BankMobileStackRow key={payment.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{payment.customerLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {paymentSourceLabel(payment.source)} · {payment.referenceCode}
                      </p>
                    </div>
                    <span className="type-finance-nums">{florin(payment.grossAmount)}</span>
                  </div>
                  <BankMobileStackField label="Date">
                    {formatActivityDateTime(payment.createdAt)}
                  </BankMobileStackField>
                </BankMobileStackRow>
              ))}
            </BankMobileStack>
            <ul className="hidden divide-y divide-border md:block">
              {analytics.recentPayments.map((payment) => (
                <li
                  key={`${payment.id}-desktop`}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{payment.customerLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.referenceCode} · {paymentSourceLabel(payment.source)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{florin(payment.grossAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatActivityDateTime(payment.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card className="!p-5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Upgrade to Alta Commercial Pro for date ranges, monthly trends, per-channel revenue
          (invoice vs payment link vs Alta Pay), top customers, success rates, and exports.
        </p>
        <Link
          to={accountCommercialRoutes.settings}
          params={{ accountId }}
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-foreground px-4 text-sm font-medium"
        >
          Upgrade to Pro
        </Link>
      </Card>
    </div>
  );
}
