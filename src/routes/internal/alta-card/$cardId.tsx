import { createFileRoute } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { AltaCardWorkspaceView, parseWorkspaceTab } from "@/components/internal/workspace";
import { fetchInternalCardOperationsContext } from "@/lib/bank/alta-card-admin.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchInternalCardFeesRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchInternalAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";

const TABS = [
  "overview",
  "transactions",
  "statements",
  "payments",
  "autopay",
  "employees",
  "relationship",
  "activity",
  "audit",
  "notes",
];

export const Route = createFileRoute("/internal/alta-card/$cardId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: parseWorkspaceTab(typeof search.tab === "string" ? search.tab : undefined, TABS),
    suggestedTier:
      typeof search.suggestedTier === "string" ? (search.suggestedTier as AltaCardTierCode) : undefined,
    suggestedLimit:
      search.suggestedLimit != null && search.suggestedLimit !== ""
        ? Number(search.suggestedLimit)
        : undefined,
    suggestedRate:
      search.suggestedRate != null && search.suggestedRate !== ""
        ? Number(search.suggestedRate)
        : undefined,
    recommendationId:
      typeof search.recommendationId === "string" ? search.recommendationId : undefined,
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ params, deps }) => {
    const tab = deps.tab;
    const includeAudit = tab === "audit";
    const includeActivity = tab === "activity";
    const includeRelationship = tab === "relationship";
    const includeNotes = tab === "notes";

    const [ops, statements, fees, autopay, auditLogs, timeline] = await Promise.all([
      fetchInternalCardOperationsContext({ data: params.cardId }),
      fetchCardStatements({ data: params.cardId }),
      fetchInternalCardFeesRecord({ data: params.cardId }),
      fetchInternalAltaCardAutopayContext({ data: params.cardId }).catch(() => ({
        context: {
          settings: {
            enabled: false,
            sourceAccountId: null,
            sourceAccountLabel: null,
            type: null,
            fixedAmount: null,
            lastRunAt: null,
            lastStatus: "not_run" as const,
            failureReason: null,
            canManage: true,
          },
          sourceAccounts: [],
        },
        audit: [],
      })),
      includeAudit
        ? fetchAuditLogsForEntity({ data: { entityType: "ALTA_CARD", entityId: params.cardId } }).catch(
            () => [],
          )
        : Promise.resolve([]),
      includeActivity
        ? fetchActivityTimeline({
            data: { entityType: "ALTA_CARD", entityId: params.cardId },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);
    const ownerUserId = ops.card.ownerUserId;
    const companyId = ops.card.companyId;
    const notes =
      includeNotes && ownerUserId
        ? await fetchInternalNotes({ data: { targetType: "USER", targetId: ownerUserId } }).catch(
            () => [],
          )
        : [];
    const integration =
      includeRelationship && ownerUserId
        ? await fetchResolvedRelationshipIntegrationBestEffort({
            userId: ownerUserId,
            companyId,
            context: "ALTA_CARD",
          })
        : null;
    return { ops, statements, fees, autopay, integration, ownerUserId, companyId, auditLogs, timeline, notes };
  },
  head: () => ({ meta: [{ title: "Alta Card — Alta Internal" }] }),
  component: AltaCardWorkspaceRoute,
});

function AltaCardWorkspaceRoute() {
  const { ops, statements, fees, autopay, integration, ownerUserId, companyId, auditLogs, timeline, notes } =
    Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AltaCardWorkspaceView
      ops={ops}
      statements={statements}
      fees={fees}
      autopay={autopay}
      integration={integration}
      ownerUserId={ownerUserId}
      companyId={companyId}
      auditLogs={auditLogs}
      notes={notes}
      timeline={timeline}
      activeTab={search.tab}
      searchDefaults={{
        tier: search.suggestedTier,
        limit: search.suggestedLimit,
        rate: search.suggestedRate,
        recommendationId: search.recommendationId,
      }}
    />
  );
}
