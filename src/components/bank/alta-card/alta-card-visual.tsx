import { useEffect, useRef, useState } from "react";
import { CreditCard } from "@/components/shared-assets/credit-card/credit-card";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_LABELS } from "@/lib/bank/alta-card-types";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<
  AltaCardTierCode,
  "alta-white" | "alta-navy" | "alta-black" | "alta-gold"
> = {
  white: "alta-white",
  navy: "alta-navy",
  black: "alta-black",
  gold: "alta-gold",
};

type AltaCardVisualProps = {
  tier: AltaCardTierCode;
  cardLastFour?: string;
  cardHolder?: string;
  cardExpiration?: string;
  width?: number;
  responsive?: boolean;
  compact?: boolean;
  className?: string;
};

export function AltaCardVisual({
  tier,
  cardLastFour = "0000",
  cardHolder = "CARDHOLDER",
  cardExpiration = "12/29",
  width,
  responsive = false,
  compact = false,
  className,
}: AltaCardVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width ?? 316);

  useEffect(() => {
    if (!responsive || width != null) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setContainerWidth(Math.min(next, 360));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [responsive, width]);

  const cardWidth = width ?? (responsive ? containerWidth : compact ? 260 : 316);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        responsive && "w-full max-w-[360px]",
        tier === "gold" && "rounded-2xl ring-1 ring-gold/35 shadow-[0_8px_32px_-8px_oklch(0.72_0.1_78/0.35)]",
        className,
      )}
    >
      <CreditCard
        company="Alta Card"
        tierLabel={ALTA_CARD_TIER_LABELS[tier]}
        cardNumber={`•••• •••• •••• ${cardLastFour}`}
        cardHolder={cardHolder.toUpperCase()}
        cardExpiration={cardExpiration}
        type={TIER_STYLES[tier]}
        brandMark="alta"
        width={cardWidth}
      />
    </div>
  );
}

/** Compact employee card row accent. */
export function AltaCardMiniChip({
  tier,
  label,
  lastFour,
}: {
  tier: AltaCardTierCode;
  label: string;
  lastFour?: string;
}) {
  const accent: Record<AltaCardTierCode, string> = {
    white: "bg-[#ebe4d6]",
    navy: "bg-[#1e3354]",
    black: "bg-[#1c1c1f]",
    gold: "bg-[oklch(0.72_0.1_78)]",
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1/80 p-3">
      <div className={cn("h-10 w-1.5 shrink-0 rounded-full", accent[tier])} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{label}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {ALTA_CARD_TIER_LABELS[tier]}
          {lastFour ? ` · •••• ${lastFour}` : ""}
        </p>
      </div>
    </div>
  );
}
