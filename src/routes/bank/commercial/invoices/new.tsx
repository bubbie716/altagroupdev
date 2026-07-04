import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceForm } from "@/components/bank/merchant-invoices/merchant-invoice-form";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/commercial/invoices/new")({
  beforeLoad: authBeforeLoad,
  loader: async ({ location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    return { companyId: companyId ?? resolved.companyId };
  },
  head: () => ({ meta: [{ title: "New Invoice — Alta Bank" }] }),
  component: NewMerchantInvoicePage,
});

function NewMerchantInvoicePage() {
  const { companyId } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="New invoice" />
      <Section title="Create invoice">
        <MerchantInvoiceForm companyId={companyId} />
      </Section>
    </>
  );
}
