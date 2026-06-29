import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardApplyForm } from "@/components/bank/alta-card/alta-card-apply-form";
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
  const context = Route.useLoaderData();
  const { companyId } = Route.useSearch();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title="Apply for business Alta Card"
      description="Company owners and treasury managers may apply for a business credit line."
     />
<AltaCardApplyForm context={context} kind="business" defaultCompanyId={companyId} />
    </>
  );
}
