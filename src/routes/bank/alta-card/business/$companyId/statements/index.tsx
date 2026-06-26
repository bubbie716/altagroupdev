import { createFileRoute, redirect } from "@tanstack/react-router";
import { AltaCardStatementsPageContent } from "@/components/bank/alta-card/alta-card-statements-page";
import { fetchPreviousStatementPeriod } from "@/lib/bank/statement.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchCompanyAltaCards } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/business/$companyId/statements/")({
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
      const [statements, defaultPeriod] = await Promise.all([
        fetchCardStatements({ data: card.id }),
        fetchPreviousStatementPeriod(),
      ]);
      return { card, statements, defaultPeriod };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/bank/alta-card/business" });
    }
  },
  head: () => ({ meta: [{ title: "Business Alta Card Statements — Alta Bank" }] }),
  component: BusinessAltaCardStatementsPage,
});

function BusinessAltaCardStatementsPage() {
  const { card, statements, defaultPeriod } = Route.useLoaderData();

  return (
    <AltaCardStatementsPageContent
      cardId={card.id}
      card={card}
      statements={statements}
      defaultPeriod={defaultPeriod}
    />
  );
}
