import { redirect } from "@tanstack/react-router";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { accountCommercialPath } from "@/lib/bank/account-commercial-path";

type LegacyCommercialTarget =
  | { kind: "overview" }
  | { kind: "invoices" }
  | { kind: "invoices-new" }
  | { kind: "invoice"; invoiceId: string }
  | { kind: "invoice-edit"; invoiceId: string }
  | { kind: "payment-links" }
  | { kind: "payment-links-new" }
  | { kind: "payment-link"; linkId: string }
  | { kind: "analytics" }
  | { kind: "settings" };

function legacyCommercialTo(
  accountId: string,
  target: LegacyCommercialTarget,
): string {
  switch (target.kind) {
    case "overview":
      return accountCommercialPath(accountId);
    case "invoices":
      return accountCommercialPath(accountId, "invoices");
    case "invoices-new":
      return `/bank/account/${accountId}/commercial/invoices/new`;
    case "invoice":
      return `/bank/account/${accountId}/commercial/invoices/${target.invoiceId}`;
    case "invoice-edit":
      return `/bank/account/${accountId}/commercial/invoices/${target.invoiceId}/edit`;
    case "payment-links":
      return accountCommercialPath(accountId, "payment-links");
    case "payment-links-new":
      return `/bank/account/${accountId}/commercial/payment-links/new`;
    case "payment-link":
      return `/bank/account/${accountId}/commercial/payment-links/${target.linkId}`;
    case "analytics":
      return accountCommercialPath(accountId, "analytics");
    case "settings":
      return accountCommercialPath(accountId, "settings");
  }
}

/** Redirect legacy `/bank/commercial/*` URLs to account-scoped commercial routes. */
export async function redirectLegacyCommercialRoute(
  searchStr: string,
  target: LegacyCommercialTarget,
): Promise<never> {
  const params = new URLSearchParams(searchStr);
  const accountId = params.get("accountId");
  if (accountId) {
    throw redirect({ to: legacyCommercialTo(accountId, target) });
  }

  const companyId = params.get("companyId") ?? undefined;
  const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId });
  if (!resolved) {
    throw redirect({ to: "/bank/business" });
  }

  throw redirect({ to: legacyCommercialTo(resolved.accountId, target) });
}
