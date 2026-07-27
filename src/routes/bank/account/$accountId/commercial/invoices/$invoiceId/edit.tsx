import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { MerchantInvoiceWorkflow } from "@/components/bank/merchant-invoices/merchant-invoice-workflow";
import { requireCommercialFromRouteContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchMerchantInvoiceDetail } from "@/lib/bank/merchant-invoice.functions";

export const Route = createFileRoute(
  "/bank/account/$accountId/commercial/invoices/$invoiceId/edit",
)({
  loader: async ({ context, params }) => {
    const commercial = requireCommercialFromRouteContext(context);
    const invoice = await fetchMerchantInvoiceDetail({
      data: { companyId: commercial.companyId, invoiceId: params.invoiceId },
    });
    if (invoice.status !== "DRAFT") {
      throw redirect({
        to: accountCommercialRoutes.invoiceDetail,
        params: { accountId: params.accountId, invoiceId: params.invoiceId },
      });
    }
    return { invoice, companyId: commercial.companyId };
  },
  head: () => ({ meta: [{ title: "Edit Invoice Draft — Business Account" }] }),
  component: AccountCommercialEditInvoicePage,
});

function AccountCommercialEditInvoicePage() {
  const router = useRouter();
  const { accountId } = Route.useParams();
  const { invoice, companyId } = Route.useLoaderData();

  function leave() {
    void router.navigate({
      to: accountCommercialRoutes.invoiceDetail,
      params: { accountId, invoiceId: invoice.id },
    });
  }

  return (
    <MerchantInvoiceWorkflow
      open
      onOpenChange={(open) => {
        if (!open) leave();
      }}
      onDone={leave}
      companyId={companyId}
      accountId={accountId}
      initialInvoice={invoice}
    />
  );
}
