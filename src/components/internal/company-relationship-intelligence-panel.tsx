"use client";

import { Link } from "@tanstack/react-router";
import { florin } from "@/lib/bank/api";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import type {
  CalculatedCompanyRelationshipProfile,
  CompanyRelationshipProfileRow,
} from "@/lib/bank/company-relationship-intelligence-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function CompanyRelationshipDetailPanel({
  companyId,
  companyName,
  profile,
  calculated,
  timelineSummary,
  onRefresh,
  refreshing = false,
}: {
  companyId: string;
  companyName: string;
  profile: CompanyRelationshipProfileRow | null;
  calculated: CalculatedCompanyRelationshipProfile;
  timelineSummary: { totalEvents: number; latestEventAt: string | null };
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const display = calculated;
  const persistedScoreMatches =
    profile == null || profile.relationshipScore === calculated.relationshipScore;

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[22px]">{companyName}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Company Relationship Profile — business products only. Independent from owner personal profiles.
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefresh}
            className="rounded border border-gold/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/10 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh profile"}
          </button>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Relationship score" value={String(display.relationshipScore)} />
        <Metric label="Relationship tier" value={COMPANY_RELATIONSHIP_TIER_LABELS[display.relationshipTier]} />
        <Metric label="Total business assets" value={florin(display.totalBusinessAssets)} />
        <Metric label="Commercial eligible" value={display.commercialBankingEligible ? "Yes" : "No"} />
        <Metric label="Relationship since" value={formatActivityDateTime(display.relationshipSince)} />
        <Metric label="Lifetime deposits" value={florin(display.lifetimeDeposits)} />
        <Metric label="Lifetime withdrawals" value={florin(display.lifetimeWithdrawals)} />
        <Metric label="Alta Pay volume" value={florin(display.lifetimeAltaPayVolume)} />
        <Metric label="Interest earned" value={florin(display.lifetimeInterestEarned)} />
        <Metric label="Interest paid" value={florin(display.lifetimeInterestPaid)} />
        <Metric label="Active business loans" value={String(display.productHoldings.activeBusinessLoans)} />
        <Metric label="Active business cards" value={String(display.productHoldings.activeBusinessCards)} />
        <Metric label="Credit exposure" value={florin(display.currentCreditExposure)} />
        <Metric label="Timeline events" value={String(timelineSummary.totalEvents)} />
      </dl>

      {!profile ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Live calculated view — refresh to persist company relationship profile.
        </p>
      ) : persistedScoreMatches ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Last calculated {formatActivityDateTime(profile.lastCalculatedAt)}
        </p>
      ) : (
        <p className="mt-4 text-[13px] text-amber-700 dark:text-amber-400">
          Live calculated scores shown — stored profile is outdated. Refresh to persist.
        </p>
      )}

      <Link
        to="/internal/companies/$companyId"
        params={{ companyId }}
        className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Company 360 →
      </Link>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CompanyProductHoldingsPanel({
  holdings,
}: {
  holdings: CalculatedCompanyRelationshipProfile["productHoldings"];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Business product holdings
      </h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-[14px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Business accounts</dt>
          <dd className="mt-1">{holdings.activeBusinessAccounts}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Business Alta Cards</dt>
          <dd className="mt-1">{holdings.activeBusinessCards}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Active business loans</dt>
          <dd className="mt-1">{holdings.activeBusinessLoans}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Paid-off loans</dt>
          <dd className="mt-1">{holdings.paidOffBusinessLoans}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Treasury</dt>
          <dd className="mt-1 text-muted-foreground">Coming soon</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Exchange / Terminal</dt>
          <dd className="mt-1 text-muted-foreground">Coming soon</dd>
        </div>
      </dl>
    </section>
  );
}
