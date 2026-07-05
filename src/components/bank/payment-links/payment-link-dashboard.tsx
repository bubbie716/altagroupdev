import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { PaymentLinkDashboard } from "@/lib/bank/payment-link-types";
import { PaymentLinkStatusBadge } from "@/components/bank/payment-links/payment-link-status-badge";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

export function PaymentLinkDashboardPanel({
  dashboard,
  companyId,
  accountId,
  canCreate = true,
  createLimitMessage,
}: {
  dashboard: PaymentLinkDashboard;
  companyId: string;
  accountId: string;
  canCreate?: boolean;
  createLimitMessage?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Active links</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Total collected</p>
          <p className="mt-1 text-2xl font-semibold">{florin(dashboard.totalCollected)}</p>
        </Card>
        <Card className="p-4">
          <p className="type-meta text-muted-foreground">Payments</p>
          <p className="mt-1 text-2xl font-semibold">{dashboard.paymentCount}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Payment links</h3>
          <div className="flex items-center gap-2">
            <Link
              to={accountCommercialRoutes.invoices}
              params={{ accountId }}
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2/60"
            >
              Invoices
            </Link>
            {canCreate ? (
              <Link
                to={accountCommercialRoutes.paymentLinksNew}
                params={{ accountId }}
                className="inline-flex items-center rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                New link
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={createLimitMessage}
                className="inline-flex cursor-not-allowed items-center rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background opacity-50"
              >
                New link
              </button>
            )}
          </div>
        </div>
        {dashboard.recent.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No payment links yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {dashboard.recent.map((link) => (
              <Link
                key={link.id}
                to={accountCommercialRoutes.paymentLinkDetail}
                params={{ accountId, linkId: link.id }}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {link.title?.trim() || link.description}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {link.referenceCode} · {link.amountType === "FIXED" && link.amount != null
                      ? florin(link.amount)
                      : "Open amount"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <PaymentLinkStatusBadge status={link.status} />
                  <span className="text-xs text-muted-foreground">{link.paymentCount} paid</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
