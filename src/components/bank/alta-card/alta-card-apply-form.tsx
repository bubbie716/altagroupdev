"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Link } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_DEFAULT_LIMITS,
  ALTA_CARD_TIER_LABELS,
  ALTA_CARD_TIER_ORDER,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_CONFIG } from "@/lib/bank/alta-card-tier-config";
import {
  submitBusinessAltaCardApplication,
  submitPersonalAltaCardApplication,
} from "@/lib/bank/alta-card.functions";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { AltaCardProductEyebrow } from "@/components/bank/alta-card/alta-card-ui-primitives";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

type ApplyContext = Awaited<
  ReturnType<typeof import("@/lib/bank/alta-card.functions").fetchAltaCardApplyContext>
>;

export function AltaCardApplyForm({
  context,
  kind,
  defaultCompanyId,
}: {
  context: ApplyContext;
  kind: "personal" | "business";
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const submitPersonal = useServerFn(submitPersonalAltaCardApplication);
  const submitBusiness = useServerFn(submitBusinessAltaCardApplication);
  const eligibleCompanies = context.businessCompanies.filter(
    (c) => !c.hasCard && !c.hasPendingApplication,
  );
  const canApplyPersonal = !context.personalCard && !context.pendingPersonalApplication;
  const canApplyBusiness = eligibleCompanies.length > 0;
  const canSubmit = kind === "personal" ? canApplyPersonal : canApplyBusiness;

  const [tier, setTier] = useState<AltaCardTierCode>("white");
  const initialCompanyId =
    defaultCompanyId && eligibleCompanies.some((c) => c.id === defaultCompanyId)
      ? defaultCompanyId
      : (eligibleCompanies[0]?.id ?? "");
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [requestedLimit, setRequestedLimit] = useState("");
  const [purpose, setPurpose] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    context.paymentSourceAccounts[0]?.id ?? "",
  );
  const [expectedSpend, setExpectedSpend] = useState("");
  const [employeeCards, setEmployeeCards] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const visibleTiers = ALTA_CARD_TIER_ORDER.filter((t) => t !== "gold" || context.isPrivateClient);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acknowledged) {
      setError("Please acknowledge the application terms");
      return;
    }
    setLoading(true);
    try {
      const limit = requestedLimit.trim() ? Number(requestedLimit) : undefined;
      if (kind === "personal") {
        const app = await submitPersonal({
          data: {
            requestedTier: tier,
            requestedLimit: limit,
            purpose: purpose.trim() || undefined,
            paymentSourceAccountId: paymentAccountId || undefined,
            acknowledged: true,
          },
        });
        await router.navigate({
          to: "/bank/alta-card/applications/$applicationId",
          params: { applicationId: app.id },
        });
      } else {
        if (!companyId) {
          setError("Select a company");
          return;
        }
        const app = await submitBusiness({
          data: {
            companyId,
            requestedTier: tier,
            requestedLimit: limit,
            purpose: purpose.trim() || undefined,
            expectedMonthlySpend: expectedSpend.trim() ? Number(expectedSpend) : undefined,
            employeeCardsNeeded: employeeCards,
            acknowledged: true,
          },
        });
        await router.navigate({
          to: "/bank/alta-card/business/applications/$applicationId",
          params: { applicationId: app.id },
        });
      }
    } catch (err) {
      setError(formatCustomerActionError(err, "card_apply"));
    } finally {
      setLoading(false);
    }
  }

  const defaultLimit = ALTA_CARD_DEFAULT_LIMITS[tier];

  if (!canSubmit) {
    return (
      <div className="rounded-xl border border-border bg-surface-1/80 p-8">
        <AltaCardProductEyebrow>
          {kind === "personal" ? "Personal Alta Card application" : "Business Alta Card application"}
        </AltaCardProductEyebrow>
        <p className="mt-3 font-serif text-[20px]">No eligible Alta Card applications</p>
        <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
          {kind === "personal"
            ? context.personalCard
              ? "You already have a personal Alta Card."
              : "You already have a personal Alta Card application in progress."
            : "Every company you manage already has a business Alta Card or an open application."}
        </p>
        {kind === "personal" && context.pendingPersonalApplication ? (
          <Link
            to="/bank/alta-card/applications/$applicationId"
            params={{ applicationId: context.pendingPersonalApplication.id }}
            className="mt-4 inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View personal application
          </Link>
        ) : kind === "personal" && context.personalCard ? (
          <Link
            to="/bank/alta-card"
            className="mt-4 inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            View personal card
          </Link>
        ) : kind === "business" ? (
          <Link
            to="/bank/alta-card/business"
            className="mt-4 inline-flex rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em]"
          >
            Back to business Alta Card
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="mx-auto w-full max-w-[320px] lg:sticky lg:top-6 lg:self-start">
        <AltaCardVisual tier={tier} cardHolder="Applicant" responsive />
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Terms set at approval
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <AltaCardProductEyebrow>
            {kind === "personal" ? "Personal Alta Card application" : "Business Alta Card application"}
          </AltaCardProductEyebrow>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {kind === "personal"
              ? "Revolving credit separate from term lending. Choose a tier and submit for manual review."
              : "Company revolving credit separate from term lending. Choose a tier and submit for manual review."}
          </p>
        </div>

        {kind === "business" ? (
          <>
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Company
              </span>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[14px]"
              >
                <option value="">Select company…</option>
                {eligibleCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Expected monthly spend (optional)
              </span>
              <input
                type="number"
                value={expectedSpend}
                onChange={(e) => setExpectedSpend(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-[14px]"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={employeeCards}
                onChange={(e) => setEmployeeCards(e.target.checked)}
              />
              Employee cards needed
            </label>
          </>
        ) : null}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Tier
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {visibleTiers.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`rounded-lg border p-3 text-left ${
                  tier === t ? "border-gold/50 bg-gold/5" : "border-border bg-surface-1"
                }`}
              >
                <p className="font-serif text-[16px]">{ALTA_CARD_TIER_LABELS[t]}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {ALTA_CARD_TIER_CONFIG[t].description}
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {defaultLimit != null
                    ? `Typical line ${defaultLimit.toLocaleString()}`
                    : "Negotiable limit & rate"}
                  {ALTA_CARD_TIER_CONFIG[t].defaultInterestRateApr != null
                    ? ` · ${ALTA_CARD_TIER_CONFIG[t].defaultInterestRateApr}% APR`
                    : ""}
                </p>
              </button>
            ))}
            {!context.isPrivateClient ? (
              <div className="rounded-lg border border-dashed border-gold/40 bg-gold/5 p-3 text-[12px]">
                <p className="font-medium text-gold">Alta Gold</p>
                <p className="mt-1 text-muted-foreground">
                  Private banking tier · Alta Private invitation only. Relationship pricing managed
                  through your private banker.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <label className="block space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Requested limit (optional)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={requestedLimit}
            onChange={(e) => setRequestedLimit(e.target.value)}
            placeholder={defaultLimit != null ? String(defaultLimit) : "Negotiable"}
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-[14px]"
          />
        </label>

        <label className="block space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Intended use / notes
          </span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[14px]"
          />
        </label>

        {kind === "personal" && context.paymentSourceAccounts.length > 0 ? (
          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Preferred payment source (optional)
            </span>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[14px]"
            >
              <option value="">None selected</option>
              {context.paymentSourceAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName} · {a.accountNumber}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand Alta Card is revolving credit, separate from term lending, and subject to
            manual underwriting based on my Alta relationship.
          </span>
        </label>

        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
        >
          {loading ? SUBMITTING_COPY.default : "Submit application"}
        </button>
      </div>
    </form>
  );
}
