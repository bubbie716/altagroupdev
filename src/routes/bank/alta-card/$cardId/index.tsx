import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardDetailView } from "@/components/bank/alta-card/alta-card-detail-view";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAltaCardDetail } from "@/lib/bank/alta-card.functions";
import { fetchCardBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";

export const Route = createFileRoute("/bank/alta-card/$cardId/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const [card, billingSummary] = await Promise.all([
        fetchAltaCardDetail({ data: params.cardId }),
        fetchCardBillingSummaryRecord({ data: params.cardId }),
      ]);
      return { card, billingSummary };
    } catch {
      throw redirect({ to: "/bank/alta-card" });
    }
  },
  head: () => ({
    meta: [{ title: "Alta Card Details — Alta Bank" }],
  }),
  component: BankAltaCardDetail,
});

function BankAltaCardDetail() {
  const { card, billingSummary } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Card details"
      description="Your revolving credit line — balance, payments, statements, and card controls."
      action={
        <Link
          to="/bank/alta-card"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          ← Alta Card home
        </Link>
      }
    >
      <BankSubNav />
      <AltaCardDetailView card={card} billingSummary={billingSummary} />
    </PageShell>
  );
}
