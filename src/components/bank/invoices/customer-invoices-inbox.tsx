import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { MerchantInvoiceSummaryRow } from "@/lib/bank/merchant-invoice-types";
import { MerchantInvoiceStatusBadge } from "@/components/bank/merchant-invoices/merchant-invoice-status-badge";

export function CustomerInvoicesInbox({ invoices }: { invoices: MerchantInvoiceSummaryRow[] }) {
  if (invoices.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        You have no invoices right now.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-border">
        {invoices.map((invoice) => (
          <Link
            key={invoice.id}
            to="/bank/invoices/$invoiceId"
            params={{ invoiceId: invoice.id }}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{invoice.merchantName}</p>
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
    </Card>
  );
}
