import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";

/** Legacy redirect — merchant invoices live under the business account commercial section. */
export const Route = createFileRoute("/bank/business/invoices")({
  loader: async ({ location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    throw redirect({
      to: "/bank/account/$accountId/commercial/invoices",
      params: { accountId: resolved.accountId },
    });
  },
});
