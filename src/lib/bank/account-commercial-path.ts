export type AccountCommercialSegment =
  | ""
  | "payments"
  | "invoices"
  | "payment-links"
  | "analytics"
  | "settings"
  | "payroll"
  | "branding";

export function accountCommercialBase(accountId: string): string {
  return `/bank/account/${accountId}/commercial`;
}

export function accountCommercialPath(
  accountId: string,
  segment?: AccountCommercialSegment,
): `/bank/account/$accountId/commercial` | `/bank/account/$accountId/commercial/${AccountCommercialSegment}` {
  if (!segment) {
    return `/bank/account/${accountId}/commercial` as `/bank/account/$accountId/commercial`;
  }
  return `/bank/account/${accountId}/commercial/${segment}` as `/bank/account/$accountId/commercial/${AccountCommercialSegment}`;
}

export function isAccountCommercialPath(pathname: string, accountId: string): boolean {
  return pathname.startsWith(accountCommercialBase(accountId));
}

/** Absolute path helpers used by redirects and unit tests. */
export function accountCommercialPaymentsPath(accountId: string): string {
  return accountCommercialPath(accountId, "payments");
}

export const accountCommercialRoutes = {
  overview: "/bank/account/$accountId/commercial",
  payments: "/bank/account/$accountId/commercial/payments",
  invoices: "/bank/account/$accountId/commercial/invoices",
  invoicesNew: "/bank/account/$accountId/commercial/invoices/new",
  invoiceDetail: "/bank/account/$accountId/commercial/invoices/$invoiceId",
  invoiceEdit: "/bank/account/$accountId/commercial/invoices/$invoiceId/edit",
  paymentLinks: "/bank/account/$accountId/commercial/payment-links",
  paymentLinksNew: "/bank/account/$accountId/commercial/payment-links/new",
  paymentLinkDetail: "/bank/account/$accountId/commercial/payment-links/$linkId",
  analytics: "/bank/account/$accountId/commercial/analytics",
  settings: "/bank/account/$accountId/commercial/settings",
  branding: "/bank/account/$accountId/commercial/branding",
  payroll: "/bank/account/$accountId/commercial/payroll",
} as const;

/** Legacy `/bank/account/$accountId/payments` must land on payments, not commercial overview. */
export function legacyAccountPaymentsRedirectTarget(
  accountId: string,
): string {
  return accountCommercialPaymentsPath(accountId);
}
