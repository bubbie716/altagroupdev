import { createFileRoute, useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardApplyWorkflow } from "@/components/bank/alta-card/alta-card-apply-workflow";
import { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import { fetchAltaCardApplyContext } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/apply")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
  },
  loader: async () => fetchAltaCardApplyContext(),
  head: () => ({
    meta: [{ title: "Apply for Alta Card — Alta Bank" }],
  }),
  component: BankAltaCardApply,
});

function BankAltaCardApply() {
  const router = useRouter();
  const context = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Alta Card"
        title="Apply for Alta Card"
        description="Submit a personal revolving credit application. Terms are set at approval based on your Alta relationship."
      />
      <AltaCardApplyWorkflow
        open
        context={context}
        kind="personal"
        onOpenChange={(nextOpen) => {
          if (!nextOpen) void router.navigate({ to: "/bank/alta-card" });
        }}
        onDone={() => void router.navigate({ to: "/bank/alta-card" })}
      />
      <div className="mt-12 border-t border-border pt-10">
        <h3 className="mb-4 font-serif text-[20px]">Tier overview</h3>
        <AltaCardTierComparison showApplyLink={false} compact />
      </div>
    </>
  );
}
