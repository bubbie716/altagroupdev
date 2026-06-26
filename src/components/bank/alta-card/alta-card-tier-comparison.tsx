import { Link } from "@tanstack/react-router";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_LABELS, formatAltaCardCurrency, formatAltaCardRate } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_CONFIG, ALTA_CARD_TIER_ORDER } from "@/lib/bank/alta-card-tier-config";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { cn } from "@/lib/utils";

const TIER_HIGHLIGHTS: Record<AltaCardTierCode, string[]> = {
  white: ["Entry revolving credit", "Standard relationship rate", "Lower credit limits"],
  navy: ["Relationship card", "Better limits & rate", "For established Alta clients"],
  black: ["Premium public tier", "Highest public limits", "Best public rate"],
  gold: ["Alta Private banking", "Negotiated terms", "Invitation only"],
};

export function AltaCardTierComparison({
  showApplyLink = true,
  compact = false,
}: {
  showApplyLink?: boolean;
  compact?: boolean;
}) {
  const tiers = ALTA_CARD_TIER_ORDER;

  return (
    <div className={cn("grid gap-4", compact ? "sm:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4")}>
      {tiers.map((code) => {
        const config = ALTA_CARD_TIER_CONFIG[code];
        const isGold = code === "gold";
        return (
          <div
            key={code}
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border bg-surface-1/60",
              isGold ? "border-gold/35 bg-gold/5" : "border-border",
            )}
          >
            <div className="flex justify-center px-4 pt-5 pb-2">
              <AltaCardVisual tier={code} cardHolder="Cardholder" compact width={220} />
            </div>
            <div className="flex flex-1 flex-col px-4 pb-5">
              <p className="font-serif text-[18px]">{config.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {config.description}
              </p>
              <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-[12px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Credit line</dt>
                  <dd className="font-mono tabular-nums text-right">
                    {config.defaultCreditLimit != null
                      ? formatAltaCardCurrency(config.defaultCreditLimit)
                      : "Negotiable"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="font-mono tabular-nums">
                    {config.defaultInterestRateApr != null
                      ? formatAltaCardRate(config.defaultInterestRateApr)
                      : "Private terms"}
                  </dd>
                </div>
              </dl>
              <ul className="mt-4 flex-1 space-y-1.5 text-[12px] text-muted-foreground">
                {TIER_HIGHLIGHTS[code].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-gold">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {isGold ? (
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                  Alta Private · by invitation
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      {showApplyLink ? (
        <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface-1/40 px-5 py-4">
          <p className="text-[13px] text-muted-foreground">
            Alta Card is revolving credit — separate from term lending. Terms are set at approval
            based on your Alta relationship.
          </p>
          <Link
            to="/bank/alta-card/apply"
            className="shrink-0 rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
          >
            Apply for Alta Card
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function AltaCardTierComparisonInline({ selectedTier }: { selectedTier?: AltaCardTierCode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {ALTA_CARD_TIER_ORDER.map((code) => (
        <div
          key={code}
          className={cn(
            "rounded-lg border p-3 text-[12px]",
            selectedTier === code ? "border-gold/50 bg-gold/5" : "border-border bg-surface-1/60",
          )}
        >
          <p className="font-serif text-[15px]">{ALTA_CARD_TIER_LABELS[code]}</p>
          <p className="mt-1 text-muted-foreground">{ALTA_CARD_TIER_CONFIG[code].description}</p>
        </div>
      ))}
    </div>
  );
}
