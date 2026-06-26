import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardApplyForm } from "@/components/bank/alta-card/alta-card-apply-form";
import { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAltaCardApplyContext } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/apply")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchAltaCardApplyContext(),
  head: () => ({
    meta: [{ title: "Apply for Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardApply,
});

function BankAltaCardApply() {
  const context = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Apply for Alta Card"
      description="Submit a personal or business revolving credit application. Terms are set at approval based on your Alta relationship."
    >
      <BankSubNav />
      <AltaCardApplyForm context={context} />
      <div className="mt-12 border-t border-border pt-10">
        <h3 className="mb-4 font-serif text-[20px]">Tier overview</h3>
        <AltaCardTierComparison showApplyLink={false} compact />
      </div>
    </PageShell>
  );
}
