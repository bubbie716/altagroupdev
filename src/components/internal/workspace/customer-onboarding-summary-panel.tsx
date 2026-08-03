import { Link, getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { CustomerOnboardingSummary } from "@/lib/onboarding/onboarding-types";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { OpsAction } from "@/components/internal/ops-action";
import {
  operatorRequireMinecraftReverificationFn,
  operatorResetMinecraftChallengeFn,
} from "@/lib/onboarding/onboarding.functions";
import { canAccessBankInternal, isCorporateAdmin } from "@/lib/auth/permissions";
import { isUiLabMode } from "@/lib/auth/ui-lab";

const rootRoute = getRouteApi("__root__");

function formatTs(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function CustomerOnboardingSummaryPanel({
  summary,
  userId,
}: {
  summary: CustomerOnboardingSummary;
  userId: string;
}) {
  const { user: actor } = rootRoute.useRouteContext();
  const resetChallenge = useServerFn(operatorResetMinecraftChallengeFn);
  const requireReverify = useServerFn(operatorRequireMinecraftReverificationFn);

  const canReset = Boolean(actor && canAccessBankInternal(actor)) && !isUiLabMode();
  const canRequireReverify = Boolean(actor && isCorporateAdmin(actor)) && !isUiLabMode();

  return (
    <div className="space-y-3 text-[12px]">
      <WorkspaceFieldGrid columns={2}>
        <WorkspaceField label="Core onboarding">
          {summary.coreOnboardingComplete ? "Complete" : "Incomplete"}
        </WorkspaceField>
        <WorkspaceField label="Legal bundle">{summary.legalBundleStatus}</WorkspaceField>
        <WorkspaceField label="Eligibility confirmed">
          {formatTs(summary.eligibilityConfirmedAt)}
        </WorkspaceField>
        <WorkspaceField label="Core completed">
          {formatTs(summary.coreOnboardingCompletedAt)}
        </WorkspaceField>
        <WorkspaceField label="Full onboarding">
          {formatTs(summary.onboardingCompletedAt)}
        </WorkspaceField>
        <WorkspaceField label="Minecraft">{summary.minecraftStatus}</WorkspaceField>
        <WorkspaceField label="Verified username">
          {summary.minecraftVerifiedAt ? summary.minecraftUsername ?? "—" : "—"}
        </WorkspaceField>
        <WorkspaceField label="Verified at">{formatTs(summary.minecraftVerifiedAt)}</WorkspaceField>
      </WorkspaceFieldGrid>

      {summary.minecraftUsername && !summary.minecraftVerifiedAt ? (
        <p className="text-muted-foreground">
          Profile Minecraft name <span className="font-mono">{summary.minecraftUsername}</span> is
          display-only and does not mean verified.
        </p>
      ) : null}

      {summary.minecraftUuid ? (
        <details className="rounded border border-border/60 bg-surface-2/30 px-3 py-2">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Technical details
          </summary>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground break-all">
            UUID {summary.minecraftUuid}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            On reverification, the UUID reservation is retained to prevent account hijack until the
            owner proves presence again.
          </p>
        </details>
      ) : null}

      {summary.challenge ? (
        <div className="rounded border border-border/60 bg-surface-2/30 px-3 py-2">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Current challenge
          </p>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Status">{summary.challenge.status}</WorkspaceField>
            <WorkspaceField label="Claimed">
              {summary.challenge.claimedUsername ?? "—"}
            </WorkspaceField>
            <WorkspaceField label="Target">
              {summary.challenge.targetX != null && summary.challenge.targetZ != null
                ? `X ${summary.challenge.targetX}, Z ${summary.challenge.targetZ}`
                : "—"}
            </WorkspaceField>
            <WorkspaceField label="Expires">{formatTs(summary.challenge.expiresAt)}</WorkspaceField>
            <WorkspaceField label="Attempts">{summary.challenge.attemptCount}</WorkspaceField>
            <WorkspaceField label="Regens">{summary.challenge.regenerationCount}</WorkspaceField>
          </WorkspaceFieldGrid>
        </div>
      ) : null}

      {(canReset || canRequireReverify) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canReset ? (
            <OpsAction
              label="Reset challenge"
              title="Reset Minecraft challenge"
              description="Expires the pending challenge. Does not mark the user verified."
              impact="The customer must generate a new verification location on their next attempt."
              onConfirm={async (reason) => {
                // OpsAction refreshes after confirm — do not invalidate here.
                await resetChallenge({ data: { userId, reason } });
              }}
            />
          ) : null}
          {canRequireReverify ? (
            <OpsAction
              label="Require reverification"
              variant="danger"
              title="Require Minecraft reverification"
              description="Clears verification status and full onboarding completion. The UUID reservation is retained."
              impact="The customer must complete Minecraft verification again on next authenticated access."
              onConfirm={async (reason) => {
                // OpsAction refreshes after confirm — do not invalidate here.
                await requireReverify({ data: { userId, reason } });
              }}
            />
          ) : null}
        </div>
      )}

      {isUiLabMode() ? (
        <p className="text-[11px] text-muted-foreground">
          Operator Minecraft actions are disabled in UI Lab.
        </p>
      ) : null}

      {summary.acceptedDocuments.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Accepted core documents
          </p>
          <ul className="space-y-1.5">
            {summary.acceptedDocuments.map((doc) => (
              <li
                key={`${doc.documentId}-${doc.version}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <Link
                  to="/legal/$docId"
                  params={{ docId: doc.documentId }}
                  className="hover:text-gold"
                >
                  {doc.title}
                </Link>
                <span className="text-muted-foreground">
                  v{doc.version} · {doc.acceptanceType} · {formatTs(doc.acceptedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">No core legal acceptances recorded.</p>
      )}

      {summary.productConsentScopes && summary.productConsentScopes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Product consent by scope
          </p>
          <ul className="space-y-2">
            {summary.productConsentScopes.map((scope) => (
              <li
                key={scope.scope}
                className="rounded border border-border/60 bg-surface-2/30 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{scope.label}</span>
                  <span className="text-muted-foreground">{scope.status}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Required: {scope.currentVersions.join(", ") || "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Accepted: {scope.acceptedVersions.join(", ") || "—"}
                  {scope.acceptedAt ? ` · ${formatTs(scope.acceptedAt)}` : ""}
                  {scope.sourceSite ? ` · ${scope.sourceSite}` : ""}
                </p>
                {scope.acceptanceSemantics.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Semantics: {scope.acceptanceSemantics.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.commercialActingFor && summary.commercialActingFor.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Commercial acceptances (as representative)
          </p>
          <ul className="space-y-1.5">
            {summary.commercialActingFor.map((row) => (
              <li key={`${row.companyId}-${row.scope}`} className="flex flex-wrap justify-between gap-2">
                <span>{row.companyName ?? row.companyId ?? row.label}</span>
                <span className="text-muted-foreground">
                  {row.status}
                  {row.acceptedAt ? ` · ${formatTs(row.acceptedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
