import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Building2, Landmark, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { RouteButton } from "@/components/bank/route-button";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

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
  const showMockData = isUserFinancialMockDataEnabled();
  const { accountId } = Route.useSearch();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Transfers"
      description={
        showMockData
          ? "Move funds within Alta Bank or send outbound wires via NCC-Net — preview interface."
          : "Choose how you want to move funds."
      }
    >
      <BankSubNav />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        <TransferTypeCard
          to="/bank/transfers/intrabank"
          accountId={accountId}
          icon={Building2}
          title="Intrabank"
          description="Instant, scheduled, and recurring transfers within Alta Bank — between your accounts or to another player."
          detail="Instant settlement · scheduled & recurring"
        />
        <TransferTypeCard
          to="/bank/transfers/interbank"
          accountId={accountId}
          icon={Landmark}
          title="Interbank"
          description="Outbound wires to external institutions — schedule future-dated or recurring wires via NCC-Net."
          detail={showMockData ? "Preview interface" : "Scheduled & recurring wires"}
        />
        <TransferTypeCard
          to="/bank/transfers/contacts"
          icon={Users}
          title="Contacts"
          description="Saved intrabank recipients and external wire beneficiaries."
          detail="Use in transfers"
        />
      </div>
    </PageShell>
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
  to: "/bank/transfers/intrabank" | "/bank/transfers/interbank" | "/bank/transfers/contacts";
  accountId?: string;
  icon: typeof Building2;
  title: string;
  description: string;
  detail: string;
}) {
  const search =
    accountId && (to === "/bank/transfers/intrabank" || to === "/bank/transfers/interbank")
      ? { accountId }
      : undefined;

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
