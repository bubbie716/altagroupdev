import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { InternalAltaCardPanel } from "@/components/bank/alta-card/internal-alta-card-panel";
import { fetchInternalAltaCardOps } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/internal/alta-card/")({
  loader: async () => fetchInternalAltaCardOps({ data: {} }),
  head: () => ({ meta: [{ title: "Alta Card Ops — Alta Internal" }] }),
  component: InternalAltaCard,
});

function InternalAltaCard() {
  const { cards, applications } = Route.useLoaderData();
  const router = useRouter();
  const pending = applications.filter((a) =>
    ["submitted", "under_review", "needs_info"].includes(a.status),
  ).length;
  const active = cards.filter((c) => c.status === "active").length;

  return (
    <InternalPageShell
      title="Alta Card"
      description="Revolving credit products — applications, limits, tiers, and employee card controls."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Pending applications" value={String(pending)} alert={pending > 0} />
        <InternalStatCard label="Active cards" value={String(active)} />
        <InternalStatCard label="Total cards" value={String(cards.length)} />
        <InternalStatCard label="Applications" value={String(applications.length)} />
      </div>

      <div className="mt-10">
        <InternalAltaCardPanel
          cards={cards}
          applications={applications}
          onRefresh={async () => {
            await router.invalidate();
          }}
        />
      </div>
    </InternalPageShell>
  );
}
