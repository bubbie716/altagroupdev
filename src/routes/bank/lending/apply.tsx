import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingApplyExperience } from "@/components/bank/lending-apply-experience";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import { fetchLendingFormContext } from "@/lib/bank/lending.functions";
import type { LoanProductTypeCode } from "@/lib/bank/lending-types";

type ApplySearch = {
  product?: LoanProductTypeCode;
};

export const Route = createFileRoute("/bank/lending/apply")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
  },
  validateSearch: (search: Record<string, unknown>): ApplySearch => {
    const product = search.product;
    if (
      product === "personal_credit_line" ||
      product === "business_credit_line" ||
      product === "private_liquidity_line"
    ) {
      return { product };
    }
    return {};
  },
  loader: async () => fetchLendingFormContext(),
  head: () => ({
    meta: [{ title: "Apply for Credit — Alta Bank Lending" }],
  }),
  component: BankLendingApply,
});

function BankLendingApply() {
  const { product } = Route.useSearch();
  const { accounts, companies } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Apply for credit"
      description="Submit a facility request for manual review. After submission, your application enters review and a Secure Deal Room opens for communication with Alta."
    >
      <BankSubNav />
      <LendingApplyExperience accounts={accounts} companies={companies} initialProduct={product} />
    </PageShell>
  );
}
