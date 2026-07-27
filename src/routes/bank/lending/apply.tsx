import { createFileRoute, useRouter } from "@tanstack/react-router";
import { LendingApplyWorkflow } from "@/components/bank/lending-apply-workflow";
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
    if (product === "personal_credit_line" || product === "business_credit_line") {
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
  const router = useRouter();
  const { product } = Route.useSearch();
  const { accounts, companies } = Route.useLoaderData();

  return (
    <LendingApplyWorkflow
      open
      accounts={accounts}
      companies={companies}
      initialProduct={product}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) void router.navigate({ to: "/bank/lending" });
      }}
      onDone={() => void router.navigate({ to: "/bank/lending" })}
    />
  );
}
