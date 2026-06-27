import { createFileRoute, redirect } from "@tanstack/react-router";
import { AltaCardStatementsPageContent } from "@/components/bank/alta-card/alta-card-statements-page";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchAltaCardDetail } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/$cardId/statements/")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    const card = await fetchAltaCardDetail({ data: params.cardId });
    if (card.cardType === "business" && card.companyId) {
      throw redirect({
        to: "/bank/alta-card/business/$companyId/statements",
        params: { companyId: card.companyId },
      });
    }
    const [statements] = await Promise.all([
      fetchCardStatements({ data: params.cardId }),
    ]);
    return { card, statements };
  },
  head: () => ({ meta: [{ title: "Alta Card Statements — Alta Bank" }] }),
  component: AltaCardStatementsPage,
});

function AltaCardStatementsPage() {
  const { cardId } = Route.useParams();
  const { card, statements } = Route.useLoaderData();

  return (
    <AltaCardStatementsPageContent
      cardId={cardId}
      card={card}
      statements={statements}
    />
  );
}
