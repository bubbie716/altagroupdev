import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BusinessRepresentativesPanel } from "@/components/bank/business-representatives-panel";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchBusinessRepresentatives } from "@/lib/bank/business-banking.functions";

export const Route = createFileRoute("/bank/account/$accountId/representatives")({
  loader: async ({ params }) => {
    const ctx = await fetchBusinessAccountContextForModule({
      data: { accountId: params.accountId, module: "representatives" },
    });
    const representatives = await fetchBusinessRepresentatives({ data: ctx.companyId });
    return {
      representatives,
      companyId: ctx.companyId,
      companyName: ctx.companyName,
    };
  },
  head: () => ({ meta: [{ title: "Team & permissions — Business Account" }] }),
  component: BusinessAccountTeamPage,
});

function BusinessAccountTeamPage() {
  const { representatives, companyId, companyName } = Route.useLoaderData();

  return (
    <Section title="Team & permissions">
      <BusinessRepresentativesPanel
        representatives={representatives}
        companyId={companyId}
        companyName={companyName}
      />
    </Section>
  );
}
