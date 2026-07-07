import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardStatementDocument } from "@/components/bank/alta-card/alta-card-statement-document";
import { AltaCardBackToCardButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { fetchCardStatementDetail } from "@/lib/bank/alta-card-statement.functions";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/statements/$statementId")({
  loader: async ({ params }) => {
    try {
      const companyCards = await fetchCompanyAltaCards({ data: params.companyId });
      const card = companyCards.businessCard;
      if (!card) {
        throw redirect({
          to: "/bank/alta-card/business/$companyId",
          params: { companyId: params.companyId },
        });
      }
      const statement = await fetchCardStatementDetail({
        data: { cardId: card.id, statementId: params.statementId },
      });
      return { card, statement };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/bank/alta-card/business" });
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Statement #${loaderData?.statement.statementNumber ?? ""} — Business Alta Card` }],
  }),
  component: BusinessAltaCardStatementDetailPage,
});

function BusinessAltaCardStatementDetailPage() {
  const { card, statement } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title={`Statement #${statement.statementNumber}`}
      description={card.companyName ?? "Business Alta Card"}
      printDocument
     />
<AltaCardPageNav className="print:hidden">
        <AltaCardBackToCardButton card={card} />
      </AltaCardPageNav>
      <AltaCardStatementDocument statement={statement} card={card} />
    </>
  );
}
