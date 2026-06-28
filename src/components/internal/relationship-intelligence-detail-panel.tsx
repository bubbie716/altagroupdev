"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { florin } from "@/lib/bank/api";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import type {
  CalculatedRelationshipProfile,
  RelationshipProfileRow,
  RelationshipTimelineSummary,
} from "@/lib/bank/relationship-intelligence-types";
import { refreshRelationshipProfileRecord } from "@/lib/internal/relationship-intelligence.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function RelationshipIntelligenceDetailPanel({
  userId,
  profile,
  calculated,
  timelineSummary,
}: {
  userId: string;
  profile: RelationshipProfileRow | null;
  calculated: CalculatedRelationshipProfile;
  timelineSummary?: RelationshipTimelineSummary | null;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = profile
    ? {
        ...profile,
        ...calculated,
        lastCalculatedAt: profile.lastCalculatedAt,
      }
    : {
        ...calculated,
        id: "",
        userId,
        lastCalculatedAt: calculated.lastCalculatedAt,
        createdAt: calculated.lastCalculatedAt,
        updatedAt: calculated.lastCalculatedAt,
      };
  const persistedScoreMatches =
    profile == null || profile.relationshipScore === calculated.relationshipScore;

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refreshRelationshipProfileRecord({ data: userId });
      await router.invalidate();
    } catch {
      setError("Could not refresh relationship profile.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Relationship profile</p>
          <h2 className="mt-2 font-serif text-[28px] tracking-tight">
            {RELATIONSHIP_TIER_LABELS[display.relationshipTier]}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Score {display.relationshipScore} · Since {formatActivityDateTime(display.relationshipSince)}
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
          className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-surface-2/80 disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh relationship profile"}
        </button>
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      {timelineSummary ? (
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Relationship history summary
          </h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-[14px]">
            <Metric
              label="Relationship since"
              value={
                timelineSummary.relationshipSince
                  ? formatActivityDateTime(timelineSummary.relationshipSince)
                  : "—"
              }
            />
            <Metric
              label="Latest timeline event"
              value={timelineSummary.latestEvent?.title ?? "—"}
            />
            <Metric label="Major milestones" value={String(timelineSummary.majorMilestoneCount)} />
            <Metric label="Product history" value={String(timelineSummary.productHistoryCount)} />
            <Metric
              label="Last activity"
              value={
                timelineSummary.lastActivityAt
                  ? formatActivityDateTime(timelineSummary.lastActivityAt)
                  : "—"
              }
            />
          </dl>
        </section>
      ) : null}

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overview</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Relationship score" value={String(display.relationshipScore)} />
          <Metric label="Relationship tier" value={RELATIONSHIP_TIER_LABELS[display.relationshipTier]} />
          <Metric label="Private banking client" value={display.privateBankingClient ? "Yes" : "No"} />
          <Metric label="Private banking eligible" value={display.privateBankingEligible ? "Yes" : "No"} />
          <Metric label="Total bank assets" value={florin(display.totalBankAssets)} />
          <Metric label="Total investments" value={florin(display.totalInvestments)} />
          <Metric label="Total Alta assets" value={florin(display.totalAltaAssets)} />
          <Metric label="Credit exposure" value={florin(display.currentCreditExposure)} />
        </dl>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Lifetime activity</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Lifetime deposits" value={florin(display.lifetimeDeposits)} />
          <Metric label="Lifetime withdrawals" value={florin(display.lifetimeWithdrawals)} />
          <Metric label="Interest earned" value={florin(display.lifetimeInterestEarned)} />
          <Metric label="Interest paid" value={florin(display.lifetimeInterestPaid)} />
          <Metric label="Alta Pay volume" value={florin(display.lifetimeAltaPayVolume)} />
          <Metric label="Loan payments" value={florin(display.lifetimeLoanPayments)} />
          <Metric label="Card payments" value={florin(display.lifetimeCardPayments)} />
        </dl>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Current exposure</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Active loan balance" value={florin(display.activeLoanBalance)} />
          <Metric label="Active card balance" value={florin(display.activeCardBalance)} />
          <Metric label="Products — bank accounts" value={String(display.productsHeld.activeBankAccounts)} />
          <Metric label="Products — Alta Cards" value={String(display.productsHeld.activeAltaCards)} />
          <Metric label="Products — active loans" value={String(display.productsHeld.activeLoans)} />
          <Metric label="Products — paid-off loans" value={String(display.productsHeld.paidOffLoans)} />
        </dl>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Factor breakdown</h3>
        <div className="mt-4 space-y-3 md:hidden">
          {calculated.factors.map((factor) => (
            <div
              key={factor.key}
              className="rounded-lg border border-border/60 bg-surface-2/20 px-3 py-3 text-[13px]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words font-medium">{factor.label}</p>
                <span
                  className={`shrink-0 tabular-nums ${
                    factor.impact > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : factor.impact < 0
                        ? "text-destructive"
                        : ""
                  }`}
                >
                  {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                </span>
              </div>
              <p className="mt-1 break-words text-muted-foreground">{factor.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain md:block">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/60 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-4">Factor</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 text-right">Impact</th>
              </tr>
            </thead>
            <tbody>
              {calculated.factors.map((factor) => (
                <tr key={factor.key} className="border-b border-border/40">
                  <td className="py-2.5 pr-4">{factor.label}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{factor.value}</td>
                  <td
                    className={`py-2.5 text-right tabular-nums ${
                      factor.impact > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : factor.impact < 0
                          ? "text-destructive"
                          : ""
                    }`}
                  >
                    {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {profile && persistedScoreMatches ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Last calculated {formatActivityDateTime(profile.lastCalculatedAt)}
        </p>
      ) : profile ? (
        <p className="text-[13px] text-amber-700 dark:text-amber-400">
          Live calculated scores shown — stored profile is outdated. Refresh to persist.
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Showing live calculated values. Refresh to persist this profile.
        </p>
      )}
    </div>
  );
}
