import { createFileRoute, useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardApplyWorkflow } from "@/components/bank/alta-card/alta-card-apply-workflow";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import { fetchAltaCardApplyContext } from "@/lib/bank/alta-card.functions";

type BusinessApplySearch = {
  companyId?: string;
};

export const Route = createFileRoute("/bank/alta-card/business/apply")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
  },
  validateSearch: (search: Record<string, unknown>): BusinessApplySearch => {
    const companyId = search.companyId;
    return typeof companyId === "string" && companyId.trim() ? { companyId: companyId.trim() } : {};
  },
  loader: async () => fetchAltaCardApplyContext(),
  head: () => ({ meta: [{ title: "Business Alta Card Application — Alta Bank" }] }),
  component: BankBusinessAltaCardApply,
});

function BankBusinessAltaCardApply() {
  const router = useRouter();
  const context = Route.useLoaderData();
  const { companyId } = Route.useSearch();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Alta Card"
        title="Apply for business Alta Card"
        description="Company owners and treasury managers may apply for a business credit line."
      />
      <AltaCardApplyWorkflow
        open
        context={context}
        kind="business"
        defaultCompanyId={companyId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) void router.navigate({ to: "/bank/alta-card/business" });
        }}
        onDone={() => void router.navigate({ to: "/bank/alta-card/business" })}
      />
    </>
  );
}
