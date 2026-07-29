import { createFileRoute } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { AltaCardWorkspaceView } from "@/components/internal/workspace";
import { fetchInternalCardOperationsContext } from "@/lib/bank/alta-card-admin.functions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import { fetchInternalCardFeesRecord } from "@/lib/bank/alta-card-interest.functions";
import { fetchInternalAltaCardAutopayContext } from "@/lib/bank/alta-card-autopay.functions";
import { fetchResolvedRelationshipIntegrationBestEffort } from "@/lib/internal/relationship-intelligence.functions";
import { fetchAuditLogsForEntity } from "@/lib/internal/audit.functions";
import { fetchActivityTimeline } from "@/lib/internal/ops-platform.functions";
import { fetchInternalNotes } from "@/lib/internal/internal-note.functions";
import { parseAltaCardWorkspaceSearch } from "@/lib/internal/internal-route-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/alta-card/$cardId")({
  validateSearch: (search: Record<string, unknown>) => parseAltaCardWorkspaceSearch(search),
  loaderDeps: ({ search }) => ({
    tab: search.tab,
    section: search.section,
    filter: search.filter,
  }),
  loader: async ({ params, deps }) => {
    const includeAudit = deps.tab === "more" || deps.section === "audit";
    const includeNotes = deps.tab === "more" || deps.section === "notes";
    const includeActivity = deps.tab === "activity" || deps.tab === "overview";
    const includeIntegration =
      deps.tab === "more" ||
      deps.section === "controls" ||
      deps.section === "statements" ||
      deps.section === "autopay" ||
      deps.section === "employees";

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
      includeIntegration && ownerUserId
        ? await fetchResolvedRelationshipIntegrationBestEffort({
            userId: ownerUserId,
            companyId,
            context: "ALTA_CARD",
          })
        : null;
    return { ops, statements, fees, autopay, integration, ownerUserId, companyId, auditLogs, timeline, notes };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Card", (match.search as { site?: string }).site) }] }),
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
      search={search}
      searchDefaults={{
        tier: search.suggestedTier as AltaCardTierCode | undefined,
        limit: search.suggestedLimit,
        rate: search.suggestedRate,
        recommendationId: search.recommendationId,
      }}
    />
  );
}
