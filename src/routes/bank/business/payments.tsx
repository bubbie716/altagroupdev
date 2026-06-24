import { createFileRoute, redirect } from "@tanstack/react-router";
import type { BusinessBankingSearch } from "./route";

export const Route = createFileRoute("/bank/business/payments")({
  beforeLoad: async ({ search }: { search: BusinessBankingSearch }) => {
    const { resolveBusinessOperatingAccountRedirect } = await import(
      "@/lib/bank/business-account.functions"
    );
    const resolved = await resolveBusinessOperatingAccountRedirect({
      data: typeof search.companyId === "string" ? search.companyId : undefined,
    });
    if (!resolved) throw redirect({ to: "/bank/business" });
    throw redirect({
      to: "/bank/account/$accountId/payments",
      params: { accountId: resolved.accountId },
    });
  },
});
