import { createFileRoute, redirect } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceForm } from "@/components/bank/merchant-invoices/merchant-invoice-form";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchMerchantInvoiceDetail } from "@/lib/bank/merchant-invoice.functions";

export const Route = createFileRoute(
  "/bank/account/$accountId/commercial/invoices/$invoiceId/edit",
)({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    const invoice = await fetchMerchantInvoiceDetail({
      data: { companyId: context.companyId, invoiceId: params.invoiceId },
    });
    if (invoice.status !== "DRAFT") {
      throw redirect({
        to: accountCommercialRoutes.invoiceDetail,
        params: { accountId: params.accountId, invoiceId: params.invoiceId },
      });
    }
    return { invoice, companyId: context.companyId };
  },
  head: () => ({ meta: [{ title: "Edit Invoice Draft — Business Account" }] }),
  component: AccountCommercialEditInvoicePage,
});

function AccountCommercialEditInvoicePage() {
  const { accountId } = Route.useParams();
  const { invoice, companyId } = Route.useLoaderData();

  return (
    <Section title={invoice.referenceCode}>
      <MerchantInvoiceForm companyId={companyId} accountId={accountId} initialInvoice={invoice} />
    </Section>
  );
}
