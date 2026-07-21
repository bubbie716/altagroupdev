import { createFileRoute } from "@tanstack/react-router";
import { ExchangePageMeta } from "@/components/exchange/exchange-page-layout";
import { EmptyState } from "@/components/data/empty-state";
import { getCorporateActions } from "@/lib/exchange/api";

export const Route = createFileRoute("/exchange/actions")({
  head: () => ({
    meta: [{ title: "Corporate Actions — Alta Exchange" }],
  }),
  component: ExchangeActions,
});

function ExchangeActions() {
  const corporateActions = getCorporateActions();

  return (
    <>
      <ExchangePageMeta
        eyebrow="Alta Exchange · Corporate Actions"
        title="Corporate Actions"
        description="Dividends, splits, buybacks, mergers, and tender offers across Alta Exchange listed issuers."
      />

      {corporateActions.length === 0 ? (
        <EmptyState
          eyebrow="Alta Exchange"
          title="No corporate actions yet."
          description="Dividends, splits, buybacks, and other issuer actions will appear here once Alta Exchange corporate action feeds are live."
          className="max-w-xl"
        />
      ) : null}
    </>
  );
}
