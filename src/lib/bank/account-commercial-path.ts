export type AccountCommercialSegment =
  | ""
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

export const accountCommercialRoutes = {
  overview: "/bank/account/$accountId/commercial",
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
