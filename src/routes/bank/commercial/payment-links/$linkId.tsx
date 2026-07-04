import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { PaymentLinkDetailPanel } from "@/components/bank/payment-links/payment-link-detail-panel";
import { fetchPaymentLinkDetail } from "@/lib/bank/payment-link.functions";
import { resolveBusinessOperatingAccountRedirect } from "@/lib/bank/business-account.functions";
import { authBeforeLoad } from "@/lib/auth/guards";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/commercial/payment-links/$linkId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params, location }) => {
    const companyId = new URLSearchParams(location.searchStr).get("companyId") ?? undefined;
    const resolved = await resolveBusinessOperatingAccountRedirect({ data: companyId ?? undefined });
    if (!resolved) {
      throw redirect({ to: "/bank/business" });
    }
    const activeCompanyId = companyId ?? resolved.companyId;
    const link = await fetchPaymentLinkDetail({
      data: { companyId: activeCompanyId, linkId: params.linkId },
    });
    return { link, companyId: activeCompanyId };
  },
  head: () => ({ meta: [{ title: "Payment Link — Alta Bank" }] }),
  component: PaymentLinkDetailPage,
});

function PaymentLinkDetailPage() {
  const { link, companyId } = Route.useLoaderData();
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <BankPageMeta eyebrow="Commercial Banking" title="Payment link" />
      <Link
        to="/bank/commercial/payment-links"
        search={{ companyId }}
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all payment links
      </Link>
      <Section title={link.referenceCode}>
        <PaymentLinkDetailPanel link={link} companyId={companyId} user={user} />
      </Section>
    </>
  );
}
