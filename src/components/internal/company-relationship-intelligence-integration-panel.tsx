"use client";

import { Link } from "@tanstack/react-router";
import { florin } from "@/lib/bank/api";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import type {
  CompanyRelationshipIntelligencePanelData,
} from "@/lib/bank/company-relationship-intelligence-types";
import type { RelationshipIntegrationContext } from "@/lib/bank/relationship-integration-config";
import { CONTEXT_LABELS } from "@/lib/bank/relationship-integration-config";
import { formatActivityDateTime } from "@/lib/format-datetime";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CompanyRelationshipIntelligencePanel({
  panel,
  context,
  compact = false,
  showLendingSignals = false,
}: {
  panel: CompanyRelationshipIntelligencePanelData;
  context?: RelationshipIntegrationContext;
  compact?: boolean;
  showLendingSignals?: boolean;
}) {
  const gridClass = compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Company relationship intelligence
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {panel.companyName}
            {context ? ` · ${CONTEXT_LABELS[context]}` : ""} — business relationship only, not the submitter&apos;s personal profile.
          </p>
        </div>
        <Link
          to="/internal/companies/$companyId/relationship"
          params={{ companyId: panel.companyId }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Full company profile →
        </Link>
      </div>

      <dl className={`mt-4 grid gap-4 ${gridClass}`}>
        <Metric label="Relationship score" value={String(panel.relationshipScore)} />
        <Metric label="Relationship tier" value={COMPANY_RELATIONSHIP_TIER_LABELS[panel.relationshipTier]} />
        <Metric label="Total business assets" value={florin(panel.totalBusinessAssets)} />
        <Metric label="Commercial eligible" value={panel.commercialBankingEligible ? "Yes" : "No"} />
        {!compact ? (
          <>
            <Metric label="Lifetime deposits" value={florin(panel.lifetimeDeposits)} />
            <Metric label="Alta Pay volume" value={florin(panel.lifetimeAltaPayVolume)} />
            <Metric label="Credit exposure" value={florin(panel.currentCreditExposure)} />
            <Metric label="Active card balance" value={florin(panel.activeCardBalance)} />
            <Metric label="Active loan balance" value={florin(panel.activeLoanBalance)} />
            <Metric label="Business accounts" value={String(panel.productHoldings.activeBusinessAccounts)} />
            <Metric label="Business cards" value={String(panel.productHoldings.activeBusinessCards)} />
            <Metric label="Active business loans" value={String(panel.productHoldings.activeBusinessLoans)} />
          </>
        ) : (
          <>
            <Metric label="Credit exposure" value={florin(panel.currentCreditExposure)} />
            <Metric label="Commercial eligible" value={panel.commercialBankingEligible ? "Yes" : "No"} />
          </>
        )}
      </dl>

      {showLendingSignals ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-surface-2/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Business lending signals
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-[13px]">
            <div>
              Business Alta Card: {panel.lendingSignals.altaCardTier ?? "None"}
              {panel.lendingSignals.altaCardStatus ? ` · ${panel.lendingSignals.altaCardStatus}` : ""}
            </div>
            <div>Delinquent business cards: {panel.lendingSignals.delinquentCardCount}</div>
            <div>Defaulted business loans: {panel.lendingSignals.defaultedLoanCount}</div>
            <div>Overdue installments: {panel.lendingSignals.overdueInstallmentCount}</div>
          </dl>
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {panel.hasPersistedProfile ? "Last calculated" : "Live calculated"}{" "}
          {formatActivityDateTime(panel.lastCalculatedAt)}
        </p>
      ) : null}
    </section>
  );
}
