import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardApplyForm } from "@/components/bank/alta-card/alta-card-apply-form";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchAltaCardApplyContext } from "@/lib/bank/alta-card.functions";

type BusinessApplySearch = {
  companyId?: string;
};

export const Route = createFileRoute("/bank/alta-card/business/apply")({
  beforeLoad: authBeforeLoad,
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
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Apply for business Alta Card"
      description="Company owners and treasury managers may apply for a business credit line."
    >
      <BankSubNav />
      <AltaCardApplyForm context={context} defaultKind="business" defaultCompanyId={companyId} />
    </PageShell>
  );
}
