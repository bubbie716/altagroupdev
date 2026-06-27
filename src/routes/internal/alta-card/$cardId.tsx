import { createFileRoute, Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAltaCardDetailPanel } from "@/components/bank/alta-card/internal-alta-card-panel";
import { InternalAltaCardOpsPanel } from "@/components/bank/alta-card/internal-alta-card-ops-panel";
import { fetchInternalCardOperationsContext } from "@/lib/bank/alta-card-admin.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchInternalCardFeesRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchInternalAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { InternalAltaCardAutopayPanel } from "@/components/bank/alta-card/internal-alta-card-autopay-panel";

export const Route = createFileRoute("/internal/alta-card/$cardId")({
  loader: async ({ params }) => {
    const [ops, statements, fees, autopay] = await Promise.all([
      fetchInternalCardOperationsContext({ data: params.cardId }),
      fetchCardStatements({ data: params.cardId }),
      fetchInternalCardFeesRecord({ data: params.cardId }),
      fetchInternalAltaCardAutopayContext({ data: params.cardId }).catch(() => ({
        context: { settings: { enabled: false, sourceAccountId: null, sourceAccountLabel: null, type: null, fixedAmount: null, lastRunAt: null, lastStatus: "not_run" as const, failureReason: null, canManage: true }, sourceAccounts: [] },
        audit: [],
      })),
    ]);
    return { ops, statements, fees, autopay };
  },
  head: () => ({ meta: [{ title: "Alta Card Detail — Alta Internal" }] }),
  component: InternalAltaCardDetail,
});

function InternalAltaCardDetail() {
  const { ops, statements, fees, autopay } = Route.useLoaderData();
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
      <InternalAltaCardAutopayPanel
        cardId={ops.card.id}
        initialContext={autopay.context}
        initialAudit={autopay.audit}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
      <InternalAltaCardDetailPanel
        card={ops.card}
        statements={statements}
        fees={fees}
        onRefresh={async () => {
          await router.invalidate();
        }}
      />
    </InternalPageShell>
  );
}
