import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { RouteButton } from "@/components/bank/route-button";
import { commercialCompanySearch } from "@/components/bank/commercial-account-back-link";

const actions = [
  {
    title: "Merchant invoices",
    description: "Create, send, and track invoices to collect payment from customers.",
    buttonLabel: "Open invoices",
    to: "/bank/commercial/invoices" as const,
  },
  {
    title: "Payment links",
    description: "Share checkout links for one-time or open-amount payments.",
    buttonLabel: "Open payment links",
    to: "/bank/commercial/payment-links" as const,
  },
] as const;

export function CommercialCollectionsLinks({
  companyId,
  accountId,
}: {
  companyId: string;
  accountId: string;
}) {
  const search = commercialCompanySearch(companyId, accountId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {actions.map((action) => (
        <Card key={action.title} className="flex flex-col !p-6">
          <div className="text-base font-medium tracking-tight">{action.title}</div>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            {action.description}
          </p>
          <RouteButton
            to={action.to}
            search={search}
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
