import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceForm } from "@/components/bank/merchant-invoices/merchant-invoice-form";
import { fetchMerchantInvoiceDetail } from "@/lib/bank/merchant-invoice.functions";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/invoices/$invoiceId/edit")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params, location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    const activeCompanyId = companyId ?? resolved.companyId;
    const invoice = await fetchMerchantInvoiceDetail({
      data: { companyId: activeCompanyId, invoiceId: params.invoiceId },
    });
    if (invoice.status !== "DRAFT") {
      throw redirect({
        to: "/bank/commercial/invoices/$invoiceId",
        params: { invoiceId: params.invoiceId },
        search: { companyId: activeCompanyId },
      });
    }
    return { invoice, companyId: activeCompanyId };
  },
  head: () => ({ meta: [{ title: "Edit Invoice Draft — Alta Bank" }] }),
  component: EditMerchantInvoiceDraftPage,
});

function EditMerchantInvoiceDraftPage() {
  const { invoice, companyId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="Edit draft invoice" />
      <Section title={invoice.referenceCode}>
        <MerchantInvoiceForm companyId={companyId} initialInvoice={invoice} />
      </Section>
    </>
  );
}
