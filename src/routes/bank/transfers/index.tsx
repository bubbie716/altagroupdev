import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { RouteButton } from "@/components/bank/route-button";

type BankTransfersHubSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/transfers/")({
  validateSearch: (search: Record<string, unknown>): BankTransfersHubSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  head: () => ({
    meta: [{ title: "Transfers — Alta Bank" }],
  }),
  component: BankTransfersHub,
});

function BankTransfersHub() {
  const { accountId } = Route.useSearch();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Transfers"
        title="Transfers"
        description="Choose how you want to move funds."
      />
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
        <TransferTypeCard
          to="/bank/transfers/intrabank"
          accountId={accountId}
          icon={Building2}
          title="Intrabank"
          description="Instant, scheduled, and recurring transfers between your own Alta Bank accounts."
          detail="Instant settlement · scheduled & recurring"
        />
        <TransferTypeCard
          to="/bank/transfers/interbank"
          accountId={accountId}
          icon={Landmark}
          title="Interbank"
          description="Transfer instantly between your Alta Bank accounts. External institution wires are coming soon."
          detail="Intrabank available now"
        />
      </div>
    </>
  );
}

function TransferTypeCard({
  to,
  accountId,
  icon: Icon,
  title,
  description,
  detail,
}: {
  to: "/bank/transfers/intrabank" | "/bank/transfers/interbank";
  accountId?: string;
  icon: typeof Building2;
  title: string;
  description: string;
  detail: string;
}) {
  const search = accountId ? { accountId } : undefined;

  return (
    <RouteButton to={to} search={search} className="group block h-full w-full text-left">
      <div className="flex h-full flex-col bg-surface-1 p-6 transition-colors hover:bg-surface-1/60">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-md border border-border bg-surface-2/60 p-2.5 text-muted-foreground transition-colors group-hover:text-foreground">
            <Icon className="size-5" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <h2 className="mt-5 font-serif text-[20px] leading-tight tracking-tight">{title}</h2>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">{detail}</p>
      </div>
    </RouteButton>
  );
}
