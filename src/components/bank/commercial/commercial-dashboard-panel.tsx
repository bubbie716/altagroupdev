import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { RouteButton } from "@/components/bank/route-button";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { CommercialDashboard } from "@/lib/bank/commercial-banking-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";

function activityLabel(kind: CommercialDashboard["recentActivity"][number]["kind"]): string {
  switch (kind) {
    case "invoice":
      return "Invoice";
    case "payment_link":
      return "Payment link";
    case "invoice_payment":
      return "Invoice payment";
    case "link_payment":
      return "Link payment";
    case "alta_pay_payment":
      return "Alta Pay";
  }
}

export function CommercialDashboardPanel({
  dashboard,
  companyId,
  accountId,
  canManage,
}: {
  dashboard: CommercialDashboard;
  companyId: string;
  accountId: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <BankStatCard
          label="Treasury balance"
          value={florin(dashboard.cashBalance)}
          sub="Business Operating Account"
          accent
        />
        <BankStatCard
          label="Outstanding receivables"
          value={florin(dashboard.outstandingInvoices)}
          sub={`${dashboard.invoiceDashboard.overdueCount} overdue`}
        />
        <BankStatCard
          label="Net receipts this month"
          value={florin(dashboard.netReceiptsThisMonth)}
          sub="Invoices, payment links & Alta Pay"
        />
        <BankStatCard
          label="Payment link volume"
          value={florin(dashboard.paymentLinkVolume)}
          sub={`${dashboard.paymentLinkDashboard.paymentCount} payments`}
        />
        <BankStatCard
          label="Alta Pay volume"
          value={florin(dashboard.altaPayVolumeThisMonth)}
          sub={`${dashboard.altaPayPaymentCountThisMonth} payment${dashboard.altaPayPaymentCountThisMonth === 1 ? "" : "s"}`}
        />
      </div>

      {canManage ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Create invoice",
              description: "Send a receivable to a customer or company.",
              to: accountCommercialRoutes.invoicesNew,
              label: "New invoice",
            },
            {
              title: "Create payment link",
              description: "Share a checkout link for fixed or open amounts.",
              to: accountCommercialRoutes.paymentLinksNew,
              label: "New payment link",
            },
            {
              title: "View analytics",
              description: "Review payment volume, net receipts, and customer trends.",
              to: accountCommercialRoutes.analytics,
              label: "Open analytics",
            },
          ].map((action) => (
            <Card key={action.title} className="flex flex-col !p-6">
              <div className="text-base font-medium tracking-tight">{action.title}</div>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {action.description}
              </p>
              <RouteButton
                to={action.to}
                params={{ accountId }}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
              >
                {action.label}
                <ArrowUpRight className="size-3.5" />
              </RouteButton>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="min-w-0 !p-0 overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Recent merchant activity
          </div>
        </div>
        {dashboard.recentActivity.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted-foreground sm:px-6">
            No merchant activity yet. Create an invoice or payment link, or receive Alta Pay
            payments to get started.
          </p>
        ) : (
          <>
            <BankMobileStack>
              {dashboard.recentActivity.map((row) => (
                <BankMobileStackRow key={`${row.kind}-${row.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{row.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activityLabel(row.kind)} · {row.status}
                      </p>
                    </div>
                    {row.amount != null ? (
                      <span className="type-finance-nums shrink-0">{florin(row.amount)}</span>
                    ) : null}
                  </div>
                  <BankMobileStackField label="Reference">{row.referenceCode}</BankMobileStackField>
                  <BankMobileStackField label="Date">
                    {formatActivityDateTime(row.createdAt)}
                  </BankMobileStackField>
                </BankMobileStackRow>
              ))}
            </BankMobileStack>
            <BankTableScroll className="px-0">
              <table className="alta-table w-full min-w-[640px] text-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentActivity.map((row) => (
                    <tr key={`${row.kind}-${row.id}-table`}>
                      <td>{activityLabel(row.kind)}</td>
                      <td>{row.label}</td>
                      <td className="type-finance-nums">
                        {row.amount != null ? florin(row.amount) : "—"}
                      </td>
                      <td className="text-muted-foreground">{row.status}</td>
                      <td className="font-mono text-[11px]">{row.referenceCode}</td>
                      <td className="text-muted-foreground">
                        {formatActivityDateTime(row.createdAt)}
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
