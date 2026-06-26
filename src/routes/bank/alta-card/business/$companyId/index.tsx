import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardBusinessPanel } from "@/components/bank/alta-card/alta-card-business-panel";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";
import { fetchCardBillingSummaryRecord } from "@/lib/bank/alta-card-interest.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      const companyCards = await fetchCompanyAltaCards({ data: params.companyId });
      const billingSummary = companyCards.businessCard
        ? await fetchCardBillingSummaryRecord({ data: companyCards.businessCard.id })
        : null;
      return { ...companyCards, billingSummary };
    } catch {
      throw redirect({ to: "/bank/alta-card/business" });
    }
  },
  head: () => ({
    meta: [{ title: "Business Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardBusinessDetail,
});

function BankAltaCardBusinessDetail() {
  const { companyId } = Route.useParams();
  const { businessCard, employeeCards, companyTransactions, pendingApplication, billingSummary, employeeMemberOptions, canManageTreasury, hasMultipleBusinessCards } =
    Route.useLoaderData();
  const router = useRouter();
  const companyName =
    businessCard?.companyName ?? pendingApplication?.companyName ?? "Company";

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title={companyName}
      action={
        <Link
          to="/bank/alta-card/business"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          ← All business cards
        </Link>
      }
    >
      <BankSubNav />
      <AltaCardBusinessPanel
        companyId={companyId}
        companyName={companyName}
        businessCard={businessCard}
        pendingApplication={pendingApplication}
        billingSummary={billingSummary}
        employeeMemberOptions={employeeMemberOptions}
        employeeCards={employeeCards}
        companyTransactions={companyTransactions}
        canManageTreasury={canManageTreasury}
        hasMultipleBusinessCards={hasMultipleBusinessCards}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
    </PageShell>
  );
}
