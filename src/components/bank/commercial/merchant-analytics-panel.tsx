import { useState } from "react";
import { Card } from "@/components/page-shell";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { MerchantAnalytics, MerchantAnalyticsRange, MerchantAnalyticsRecentPayment } from "@/lib/bank/commercial-banking-types";
import { MERCHANT_ANALYTICS_RANGES, MERCHANT_ANALYTICS_RANGE_LABELS } from "@/lib/bank/commercial-banking-types";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";
import { cn } from "@/lib/utils";

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

export function MerchantAnalyticsPanel({
  analytics,
  onRangeChange,
}: {
  analytics: MerchantAnalytics;
  onRangeChange: (range: MerchantAnalyticsRange) => void;
}) {
  const [activeRange, setActiveRange] = useState(analytics.range);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {MERCHANT_ANALYTICS_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => {
              setActiveRange(range);
              onRangeChange(range);
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
              activeRange === range
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {MERCHANT_ANALYTICS_RANGE_LABELS[range]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <BankStatCard
          label="Payment volume"
          value={florin(analytics.grossVolume)}
          sub={`${analytics.successfulPayments} successful`}
          accent
        />
        <BankStatCard
          label="Net receipts"
          value={florin(analytics.netVolume)}
          sub={`${florin(analytics.totalFees)} fees`}
        />
        <BankStatCard
          label="Invoice revenue"
          value={florin(analytics.invoiceRevenue)}
          sub={`${analytics.paidInvoicesCount} paid invoices`}
        />
        <BankStatCard
          label="Payment link revenue"
          value={florin(analytics.paymentLinkRevenue)}
          sub={`${analytics.paymentFailureRate}% failed`}
        />
        <BankStatCard
          label="Alta Pay revenue"
          value={florin(analytics.altaPayRevenue)}
          sub="Instant intrabank"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BankStatCard
          label="Outstanding receivables"
          value={florin(analytics.outstandingInvoiceTotal)}
          sub="Open invoices"
        />
        <BankStatCard
          label="Overdue receivables"
          value={florin(analytics.overdueInvoiceTotal)}
          sub="Past due"
        />
        <BankStatCard
          label="Average payment size"
          value={florin(analytics.averagePaymentSize)}
          sub={`${analytics.paymentSuccessRate}% success rate`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Top customers
            </div>
          </div>
          {analytics.topCustomers.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted-foreground">No customer payments yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {analytics.topCustomers.map((customer) => (
                <div
                  key={customer.customerLabel}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{customer.customerLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.paymentCount} payment{customer.paymentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="type-finance-nums">{florin(customer.grossVolume)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Monthly revenue trend
            </div>
          </div>
          {analytics.monthlyTrend.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted-foreground">No trend data yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {analytics.monthlyTrend.map((point) => (
                <div
                  key={point.month}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">{point.month}</span>
                  <div className="text-right">
                    <p className="type-finance-nums">{florin(point.grossVolume)}</p>
                    <p className="text-xs text-muted-foreground">
                      Net {florin(point.netVolume)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="min-w-0 !p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Recent payments
          </div>
        </div>
        {analytics.recentPayments.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground sm:px-6">
            No payments in this period.
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
                        {paymentSourceLabel(payment.source)}
                      </p>
                    </div>
                    <span className="type-finance-nums">{florin(payment.grossAmount)}</span>
                  </div>
                  <BankMobileStackField label="Net">{florin(payment.netAmount)}</BankMobileStackField>
                  <BankMobileStackField label="Reference">{payment.referenceCode}</BankMobileStackField>
                  <BankMobileStackField label="Date">
                    {formatActivityDateTime(payment.createdAt)}
                  </BankMobileStackField>
                </BankMobileStackRow>
              ))}
            </BankMobileStack>
            <BankTableScroll className="px-0">
              <table className="alta-table w-full min-w-[640px] text-sm">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Source</th>
                    <th>Gross</th>
                    <th>Net</th>
                    <th>Reference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentPayments.map((payment) => (
                    <tr key={`${payment.id}-table`}>
                      <td>{payment.customerLabel}</td>
                      <td className="text-muted-foreground">
                        {paymentSourceLabel(payment.source)}
                      </td>
                      <td className="type-finance-nums">{florin(payment.grossAmount)}</td>
                      <td className="type-finance-nums">{florin(payment.netAmount)}</td>
                      <td className="font-mono text-[11px]">{payment.referenceCode}</td>
                      <td className="text-muted-foreground">
                        {formatActivityDateTime(payment.createdAt)}
                      </td>
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
