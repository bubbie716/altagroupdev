import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import { PageShell, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

export const Route = createFileRoute("/bank/transfers/")({
  head: () => ({
    meta: [{ title: "Transfers — Alta Bank" }],
  }),
  component: BankTransfersHub,
});

function BankTransfersHub() {
  const showMockData = isUserFinancialMockDataEnabled();

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

      <div className="grid gap-4 md:grid-cols-2">
        <TransferTypeCard
          to="/bank/transfers/intrabank"
          icon={Building2}
          title="Intrabank"
          description="Instant transfers within Alta Bank — between your accounts or to another player."
          detail="Settles immediately within Alta Bank"
        />
        <TransferTypeCard
          to="/bank/transfers/interbank"
          icon={Landmark}
          title="Interbank"
          description="Outbound wires to external institutions and recipients via NCC-Net settlement."
          detail={showMockData ? "Preview interface" : "Coming soon"}
        />
      </div>
    </PageShell>
  );
}

function TransferTypeCard({
  to,
  icon: Icon,
  title,
  description,
  detail,
}: {
  to: string;
  icon: typeof Building2;
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <Link to={to} className="group block h-full">
      <Card className="flex h-full flex-col !p-6 transition-colors hover:border-border-strong hover:bg-surface-2/30">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-md border border-border bg-surface-2/60 p-2.5 text-muted-foreground transition-colors group-hover:text-foreground">
            <Icon className="size-5" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{detail}</p>
      </Card>
    </Link>
  );
}
