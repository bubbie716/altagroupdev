import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { PaymentLinkDetailPanel } from "@/components/bank/payment-links/payment-link-detail-panel";
import { loadAccountCommercialContext } from "@/lib/bank/account-commercial-loader";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchPaymentLinkDetail } from "@/lib/bank/payment-link.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/$linkId")({
  loader: async ({ params }) => {
    const { context } = await loadAccountCommercialContext(params.accountId);
    const link = await fetchPaymentLinkDetail({
      data: { companyId: context.companyId, linkId: params.linkId },
    });
    return { link, companyId: context.companyId };
  },
  head: () => ({ meta: [{ title: "Payment Link — Business Account" }] }),
  component: AccountCommercialPaymentLinkDetailPage,
});

function AccountCommercialPaymentLinkDetailPage() {
  const { accountId } = Route.useParams();
  const { link, companyId } = Route.useLoaderData();
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <Link
        to={accountCommercialRoutes.paymentLinks}
        params={{ accountId }}
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
