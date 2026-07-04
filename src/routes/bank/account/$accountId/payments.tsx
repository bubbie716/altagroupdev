import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { AltaPayReceivedPanel } from "@/components/bank/alta-pay-received-panel";
import { CommercialCollectionsLinks } from "@/components/bank/commercial-collections-links";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchCompanyAltaPayReceived } from "@/lib/bank/alta-pay.functions";
import { canViewAltaPayReceived, canViewMerchantInvoices } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/payments")({
  loader: async ({ params }) => {
    const ctx = await fetchBusinessAccountContextForModule({
      data: { accountId: params.accountId, module: "payments" },
    });
    const altaPayReceived = await fetchCompanyAltaPayReceived({ data: ctx.companyId }).catch(
      () => null,
    );
    return { altaPayReceived };
  },
  head: () => ({ meta: [{ title: "Payments — Business Account" }] }),
  component: BusinessAccountPaymentsPage,
});

function BusinessAccountPaymentsPage() {
  const { businessContext } = AccountRoute.useLoaderData();
  const { altaPayReceived } = Route.useLoaderData();
  const { accountId } = Route.useParams();
  const user = useCurrentUser();

  if (!businessContext) {
    return <p className="text-[13px] text-muted-foreground">Business account access required.</p>;
  }

  const showAltaPayReceived =
    altaPayReceived !== null &&
    user !== null &&
    canViewAltaPayReceived(user, { companyId: businessContext.companyId });

  const showCommercialCollections =
    user !== null &&
    canViewMerchantInvoices(user, { companyId: businessContext.companyId });

  return (
    <div className="space-y-8">
      {showCommercialCollections ? (
        <Section title="Collect payments">
          <CommercialCollectionsLinks
            companyId={businessContext.companyId}
            accountId={accountId}
          />
        </Section>
      ) : null}

      {showAltaPayReceived ? (
        <Section title="Customer payments received">
          <AltaPayReceivedPanel summary={altaPayReceived} />
        </Section>
      ) : showCommercialCollections ? null : (
        <p className="text-[13px] text-muted-foreground">
          Payment tools are available to owners, executives, and finance managers.
        </p>
      )}
    </div>
  );
}
