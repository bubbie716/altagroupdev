"use client";

import { Link } from "@tanstack/react-router";
import { florin } from "@/lib/bank/api";
import {
  altaPrivateStatusLabel,
  displayRelationshipTierLabel,
} from "@/lib/bank/relationship-terminology";
import type {
  RelationshipIntegrationContext,
  RelationshipIntelligencePanelData,
} from "@/lib/bank/relationship-intelligence-types";
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

export function RelationshipIntelligencePanel({
  panel,
  context,
  compact = false,
  showLendingSignals = false,
}: {
  panel: RelationshipIntelligencePanelData;
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
            Relationship Intelligence
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {context ? CONTEXT_LABELS[context] : "Read-only relationship profile"} — informs decisions only.
          </p>
        </div>
        <Link
          to="/internal/relationships/$userId"
          params={{ userId: panel.userId }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Full profile →
        </Link>
      </div>

      <dl className={`mt-4 grid gap-4 ${gridClass}`}>
        <Metric label="Relationship score" value={String(panel.relationshipScore)} />
        <Metric
          label="Relationship tier"
          value={displayRelationshipTierLabel(panel.relationshipTier, panel.relationshipScore)}
        />
        <Metric label="Total Alta assets" value={florin(panel.totalAltaAssets)} />
        <Metric label="Total bank assets" value={florin(panel.totalBankAssets)} />
        {!compact ? (
          <>
            <Metric label="Lifetime deposits" value={florin(panel.lifetimeDeposits)} />
            <Metric label="Alta Pay volume" value={florin(panel.lifetimeAltaPayVolume)} />
            <Metric label="Credit exposure" value={florin(panel.currentCreditExposure)} />
            <Metric label="Active card balance" value={florin(panel.activeCardBalance)} />
            <Metric label="Active loan balance" value={florin(panel.activeLoanBalance)} />
            <Metric
              label="Alta Private eligibility"
              value={panel.privateBankingEligible ? "Eligible" : "Not eligible"}
            />
            <Metric
              label="Alta Private membership"
              value={altaPrivateStatusLabel(panel.privateBankingClient, panel.privateBankingEligible)}
            />
            <Metric label="Lifetime loan payments" value={florin(panel.lifetimeLoanPayments)} />
          </>
        ) : (
          <>
            <Metric label="Credit exposure" value={florin(panel.currentCreditExposure)} />
            <Metric
              label="Alta Private"
              value={altaPrivateStatusLabel(panel.privateBankingClient, panel.privateBankingEligible)}
            />
          </>
        )}
      </dl>

      {showLendingSignals ? (
        <div className="mt-4 rounded-lg border border-border/60 bg-surface-2/30 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Lending signals
          </p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-[13px]">
            <div>
              Alta Card: {panel.lendingSignals.altaCardTier ?? "None"}
              {panel.lendingSignals.altaCardStatus ? ` · ${panel.lendingSignals.altaCardStatus}` : ""}
            </div>
            <div>Delinquent cards: {panel.lendingSignals.delinquentCardCount}</div>
            <div>Defaulted loans: {panel.lendingSignals.defaultedLoanCount}</div>
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
