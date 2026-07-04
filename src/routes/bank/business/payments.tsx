import { createFileRoute, redirect } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import type { BusinessBankingSearch } from "./route";

export const Route = createFileRoute("/bank/business/payments")({
  beforeLoad: async (ctx) => {
    authBeforeLoad(ctx);
    const { search } = ctx;
    const { resolveBusinessOperatingAccountRedirect } = await import(
      "@/lib/bank/business-account.functions"
    );
    const resolved = await resolveBusinessOperatingAccountRedirect({
      data: typeof search.companyId === "string" ? search.companyId : undefined,
    });
    if (!resolved) throw redirect({ to: "/bank/business" });
    throw redirect({
      to: "/bank/account/$accountId/commercial",
      params: { accountId: resolved.accountId },
    });
  },
});
