import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceDetailPanel } from "@/components/bank/merchant-invoices/merchant-invoice-detail-panel";
import { fetchMerchantInvoiceDetail } from "@/lib/bank/merchant-invoice.functions";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/commercial/invoices/$invoiceId")({
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
    return { invoice, companyId: activeCompanyId };
  },
  head: () => ({ meta: [{ title: "Invoice Detail — Alta Bank" }] }),
  component: MerchantInvoiceDetailPage,
});

function MerchantInvoiceDetailPage() {
  const { invoice, companyId } = Route.useLoaderData();
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="Invoice detail" />
      <Link
        to="/bank/commercial/invoices"
        search={{ companyId }}
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all invoices
      </Link>
      <Section title={invoice.referenceCode}>
        <MerchantInvoiceDetailPanel invoice={invoice} companyId={companyId} user={user} />
      </Section>
    </>
  );
}
