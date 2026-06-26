import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardStatementDocument } from "@/components/bank/alta-card/alta-card-statement-document";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchCardStatementDetail } from "@/lib/bank/alta-card-statement.functions";
import { fetchAltaCardDetail } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/$cardId/statements/$statementId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    const card = await fetchAltaCardDetail({ data: params.cardId });
    if (card.cardType === "business" && card.companyId) {
      throw redirect({
        to: "/bank/alta-card/business/$companyId/statements/$statementId",
        params: { companyId: card.companyId, statementId: params.statementId },
      });
    }
    const statement = await fetchCardStatementDetail({
      data: { cardId: params.cardId, statementId: params.statementId },
    });
    return { card, statement };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Statement #${loaderData?.statement.statementNumber ?? ""} — Alta Card` }],
  }),
  component: AltaCardStatementDetailPage,
});

function AltaCardStatementDetailPage() {
  const { card, statement } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title={`Statement #${statement.statementNumber}`}
      description={cardSubtitle(card)}
      printDocument
      hideFooter
    >
      <BankSubNav className="print:hidden" />
      <AltaCardStatementDocument statement={statement} card={card} />
    </PageShell>
  );
}

function cardSubtitle(card: { cardType: string; companyName: string | null; ownerUsername: string | null }): string {
  if (card.cardType === "business" && card.companyName) return card.companyName;
  return card.ownerUsername ?? "Alta Card";
}
