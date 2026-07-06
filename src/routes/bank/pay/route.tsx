import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AltaPaySubNav, type AltaPaySubNavTab } from "@/components/bank/alta-pay-sub-nav";
import { fetchUnreadReceivedInvoiceCount } from "@/lib/bank/merchant-invoice.functions";

function resolveAltaPaySubNavTab(pathname: string, tab?: string): AltaPaySubNavTab {
  if (pathname.startsWith("/bank/pay/invoices")) return "invoices";
  if (tab === "scheduled" || tab === "recurring" || tab === "autopay") return tab;
  return "now";
}

export const Route = createFileRoute("/bank/pay")({
  loader: async () => {
    const unreadInvoiceCount = await fetchUnreadReceivedInvoiceCount();
    return { unreadInvoiceCount };
  },
  component: AltaPayLayout,
});

function AltaPayLayout() {
  const { unreadInvoiceCount } = Route.useLoaderData();
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const tabParam = new URLSearchParams(searchStr).get("tab") ?? undefined;
  const activeTab = resolveAltaPaySubNavTab(pathname, tabParam);

  return (
    <>
      <AltaPaySubNav activeTab={activeTab} unreadInvoiceCount={unreadInvoiceCount} />
      <Outlet />
    </>
  );
}
