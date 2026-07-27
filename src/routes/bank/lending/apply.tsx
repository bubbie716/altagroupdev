import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";
import type { LoanProductTypeCode } from "@/lib/bank/lending-types";

type ApplySearch = {
  product?: LoanProductTypeCode;
};

/** Legacy deep link — apply opens as a modal on the Lending page. */
export const Route = createFileRoute("/bank/lending/apply")({
  validateSearch: (search: Record<string, unknown>): ApplySearch => {
    const product = search.product;
    if (product === "personal_credit_line" || product === "business_credit_line") {
      return { product };
    }
    return {};
  },
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
    throw redirect({
      to: "/bank/lending",
      search: ctx.search.product
        ? { apply: "1", product: ctx.search.product }
        : { apply: "1" },
      replace: true,
    });
  },
});
