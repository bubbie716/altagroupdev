import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BusinessRepresentativesPanel } from "@/components/bank/business-representatives-panel";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchBusinessRepresentatives } from "@/lib/bank/business-banking.functions";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/representatives")({
  loader: async ({ params }) => {
    const ctx = await fetchBusinessAccountContextForModule({
      data: { accountId: params.accountId, module: "representatives" },
    });
    const representatives = await fetchBusinessRepresentatives({ data: ctx.companyId });
    return { representatives };
  },
  head: () => ({ meta: [{ title: "Representatives — Business Account" }] }),
  component: BusinessAccountRepresentativesPage,
});

function BusinessAccountRepresentativesPage() {
  const { representatives } = Route.useLoaderData();

  return (
    <Section title="Authorized representatives">
      <BusinessRepresentativesPanel representatives={representatives} />
    </Section>
  );
}
