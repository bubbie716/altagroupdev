import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { creditDeskApplicationBeforeLoad } from "@/lib/auth/credit-desk-guards";

type BusinessApplySearch = {
  companyId?: string;
};

/** Legacy deep link — business apply opens as a modal on the business Alta Card page. */
export const Route = createFileRoute("/bank/alta-card/business/apply")({
  validateSearch: (search: Record<string, unknown>): BusinessApplySearch => {
    const companyId = search.companyId;
    return typeof companyId === "string" && companyId.trim() ? { companyId: companyId.trim() } : {};
  },
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    await creditDeskApplicationBeforeLoad(ctx);
    throw redirect({
      to: "/bank/alta-card/business",
      search: ctx.search.companyId
        ? { apply: "1", companyId: ctx.search.companyId }
        : { apply: "1" },
      replace: true,
    });
  },
});
