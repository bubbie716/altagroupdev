import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { RouteButton } from "@/components/bank/route-button";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

const actions = [
  {
    title: "Alta Commercial",
    description: "Treasury overview, receivables, payment links, and merchant analytics.",
    buttonLabel: "Open Alta Commercial",
    to: accountCommercialRoutes.overview,
  },
  {
    title: "Merchant invoices",
    description: "Create, send, and track invoices to collect payment from customers.",
    buttonLabel: "Open invoices",
    to: accountCommercialRoutes.invoices,
  },
  {
    title: "Payment links",
    description: "Share checkout links for one-time or open-amount payments.",
    buttonLabel: "Open payment links",
    to: accountCommercialRoutes.paymentLinks,
  },
] as const;

export function CommercialCollectionsLinks({ accountId }: { accountId: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => (
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
            {action.buttonLabel}
            <ArrowUpRight className="size-3.5" />
          </RouteButton>
        </Card>
      ))}
    </div>
  );
}
