import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { MerchantInvoiceDashboard } from "@/lib/bank/merchant-invoice-types";
import { MerchantInvoiceStatusBadge } from "@/components/bank/merchant-invoices/merchant-invoice-status-badge";

export function MerchantInvoiceDashboardPanel({
  dashboard,
  companyId,
  canCreate = true,
}: {
  dashboard: MerchantInvoiceDashboard;
  companyId: string;
  canCreate?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold">{florin(dashboard.outstandingTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Paid this month</p>
          <p className="mt-1 text-2xl font-semibold">{florin(dashboard.paidThisMonth)}</p>
        </Card>
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Overdue</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.overdueCount}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Recent invoices</h3>
          {canCreate ? (
            <Link
              to="/bank/commercial/invoices/new"
              search={{ companyId }}
              className="inline-flex items-center rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              New invoice
            </Link>
          ) : null}
        </div>
        {dashboard.recent.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {dashboard.recent.map((invoice) => (
              <Link
                key={invoice.id}
                to="/bank/commercial/invoices/$invoiceId"
                params={{ invoiceId: invoice.id }}
                search={{ companyId }}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invoice.recipientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {invoice.referenceCode} · {invoice.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <MerchantInvoiceStatusBadge status={invoice.status} />
                  <span className="text-sm font-medium">{florin(invoice.amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
