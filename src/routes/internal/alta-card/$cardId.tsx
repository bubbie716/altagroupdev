import { createFileRoute, Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAltaCardDetailPanel } from "@/components/bank/alta-card/internal-alta-card-panel";
import { InternalAltaCardOpsPanel } from "@/components/bank/alta-card/internal-alta-card-ops-panel";
import { fetchInternalCardOperationsContext } from "@/lib/bank/alta-card-admin.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchInternalCardFeesRecord } from "@/lib/bank/alta-card-interest.functions";

export const Route = createFileRoute("/internal/alta-card/$cardId")({
  loader: async ({ params }) => {
    const [ops, statements, fees] = await Promise.all([
      fetchInternalCardOperationsContext({ data: params.cardId }),
      fetchCardStatements({ data: params.cardId }),
      fetchInternalCardFeesRecord({ data: params.cardId }),
    ]);
    return { ops, statements, fees };
  },
  head: () => ({ meta: [{ title: "Alta Card Detail — Alta Internal" }] }),
  component: InternalAltaCardDetail,
});

function InternalAltaCardDetail() {
  const { ops, statements, fees } = Route.useLoaderData();
  const router = useRouter();

  return (
    <InternalPageShell
      title="Alta Card detail"
      description="Full card operations — status, terms, payments, adjustments, and relationship pricing."
    >
      <Link
        to="/internal/alta-card"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← All cards
      </Link>
      <InternalAltaCardOpsPanel
        ops={ops}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
      <InternalAltaCardDetailPanel
        card={ops.card}
        statements={statements}
        fees={fees}
        billingOnly
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
    </InternalPageShell>
  );
}
