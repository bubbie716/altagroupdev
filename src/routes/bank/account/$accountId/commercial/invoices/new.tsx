import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceForm } from "@/components/bank/merchant-invoices/merchant-invoice-form";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";

export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/new")({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    return { companyId: context.companyId };
  },
  head: () => ({ meta: [{ title: "New Invoice — Business Account" }] }),
  component: AccountCommercialNewInvoicePage,
});

function AccountCommercialNewInvoicePage() {
  const { accountId } = Route.useParams();
  const { companyId } = Route.useLoaderData();

  return (
    <Section title="Create invoice">
      <MerchantInvoiceForm companyId={companyId} accountId={accountId} />
    </Section>
  );
}
